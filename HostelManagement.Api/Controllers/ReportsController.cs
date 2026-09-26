using HostelManagement.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/reports")]
public class ReportsController : ControllerBase
{
    private readonly HostelDbContext _db;

    public ReportsController(HostelDbContext db)
    {
        _db = db;
    }

    // GET /api/hostels/1/reports/summary?fromDate=2026-09-01&toDate=2026-09-30
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        long hostelId,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startDate = fromDate ?? new DateOnly(today.Year, today.Month, 1);
        var endDate = toDate ?? today;

        if (endDate < startDate)
        {
            return BadRequest(new
            {
                message = "toDate must be on or after fromDate."
            });
        }

        var endExclusive = endDate.AddDays(1);

        var activeRooms = _db.Rooms
            .AsNoTracking()
            .Where(r => r.HostelId == hostelId && r.IsActive);

        var roomCount = await activeRooms.CountAsync(cancellationToken);

        var totalCapacity =
            await activeRooms.Select(r => (int?)r.Capacity)
                .SumAsync(cancellationToken) ?? 0;

        var activeTenantCount = await _db.Tenants
            .AsNoTracking()
            .CountAsync(
                t => t.HostelId == hostelId && t.IsActive,
                cancellationToken);

        var occupiedBeds = await (
            from tenant in _db.Tenants.AsNoTracking()
            join room in activeRooms on tenant.RoomId equals room.Id
            where tenant.HostelId == hostelId && tenant.IsActive
            select tenant.Id)
            .CountAsync(cancellationToken);

        var vacantRooms = await activeRooms
            .CountAsync(
                r => !_db.Tenants.Any(
                    t => t.RoomId == r.Id && t.IsActive),
                cancellationToken);

        var billsInPeriod = _db.Bills
            .AsNoTracking()
            .Where(b => b.HostelId == hostelId
                        && b.IssueDate >= startDate
                        && b.IssueDate < endExclusive
                        && b.Status != "Cancelled"
                        && b.Status != "Draft");

        var billedAmount =
            await billsInPeriod.Select(b => (decimal?)b.TotalAmount)
                .SumAsync(cancellationToken) ?? 0m;

        var outstandingBills = _db.Bills
            .AsNoTracking()
            .Where(b => b.HostelId == hostelId
                        && (b.Status == "Pending" || b.Status == "Overdue"));

        var outstandingAmount =
            await outstandingBills.Select(b => (decimal?)b.TotalAmount)
                .SumAsync(cancellationToken) ?? 0m;

        var overdueQuery = outstandingBills.Where(
            b => b.Status == "Overdue"
                 || (b.Status == "Pending" && b.DueDate < today));

        var overdueCount = await overdueQuery.CountAsync(cancellationToken);

        var overdueAmount =
            await overdueQuery.Select(b => (decimal?)b.TotalAmount)
                .SumAsync(cancellationToken) ?? 0m;

        var fromUtc = DateTime.SpecifyKind(
            startDate.ToDateTime(TimeOnly.MinValue),
            DateTimeKind.Utc);

        var untilUtc = DateTime.SpecifyKind(
            endExclusive.ToDateTime(TimeOnly.MinValue),
            DateTimeKind.Utc);

        var collectedBills = await _db.Bills
            .AsNoTracking()
            .Where(b => b.HostelId == hostelId
                        && b.Status == "Paid"
                        && b.PaidAt != null
                        && b.PaidAt >= fromUtc
                        && b.PaidAt < untilUtc)
            .Select(b => new
            {
                b.PaidAt,
                b.TotalAmount
            })
            .ToListAsync(cancellationToken);

        var collectedAmount = collectedBills.Sum(b => b.TotalAmount);

        var collectionTrend = collectedBills
            .Where(b => b.PaidAt.HasValue)
            .GroupBy(b => DateOnly.FromDateTime(
                DateTime.SpecifyKind(b.PaidAt!.Value, DateTimeKind.Utc)))
            .OrderBy(group => group.Key)
            .Select(group => new
            {
                date = group.Key,
                amount = group.Sum(item => item.TotalAmount)
            })
            .ToList();

        var occupancyPercentage = totalCapacity == 0
            ? 0
            : Math.Round(occupiedBeds * 100m / totalCapacity, 2);

        return Ok(new
        {
            period = new { fromDate = startDate, toDate = endDate },
            activeTenantCount,
            activeRoomCount = roomCount,
            totalCapacity,
            occupiedBeds,
            vacantRooms,
            occupancyPercentage,
            billedAmount,
            collectedAmount,
            outstandingBillCount = await outstandingBills.CountAsync(cancellationToken),
            outstandingAmount,
            overdueCount,
            overdueAmount,
            collectionTrend
        });
    }
}