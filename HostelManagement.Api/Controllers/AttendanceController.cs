using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/attendance")]
public class AttendanceController : ControllerBase
{
    private static readonly string[] AllowedStatuses =
        ["Present", "Absent", "Leave"];

    private readonly HostelDbContext _db;
    private readonly ILogger<AttendanceController> _logger;

    public AttendanceController(
        HostelDbContext db,
        ILogger<AttendanceController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // GET /api/hostels/1/attendance?date=2026-09-25
    [HttpGet]
    public async Task<IActionResult> GetForDate(
        long hostelId,
        [FromQuery] DateOnly? date,
        CancellationToken cancellationToken)
    {
        var attendanceDate =
            date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var records = await (
            from attendance in _db.AttendanceRecords.AsNoTracking()
            join tenant in _db.Tenants.AsNoTracking()
                on attendance.TenantId equals tenant.Id
            where attendance.HostelId == hostelId
                  && attendance.AttendanceDate == attendanceDate
                  && tenant.IsActive
            orderby tenant.FullName
            select new
            {
                attendance.Id,
                attendance.HostelId,
                attendance.TenantId,
                TenantName = tenant.FullName,
                attendance.AttendanceDate,
                attendance.Status,
                attendance.Notes
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            date = attendanceDate,
            records
        });
    }

    // PUT /api/hostels/1/attendance/12
    // Creates or updates this tenant's attendance for the date in the body.
    [HttpPut("{tenantId:long}")]
    public async Task<IActionResult> Save(
        long hostelId,
        long tenantId,
        SaveAttendanceRequest request,
        CancellationToken cancellationToken)
    {
        if (!AllowedStatuses.Contains(
                request.Status,
                StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = "Status must be Present, Absent, or Leave."
            });
        }

        var tenantExists = await _db.Tenants.AnyAsync(
            t => t.Id == tenantId
                 && t.HostelId == hostelId
                 && t.IsActive,
            cancellationToken);

        if (!tenantExists)
            return NotFound(new { message = "Active tenant not found." });

        var status = AllowedStatuses.First(x =>
            string.Equals(x, request.Status, StringComparison.OrdinalIgnoreCase));

        var record = await _db.AttendanceRecords.FirstOrDefaultAsync(
            x => x.HostelId == hostelId
                 && x.TenantId == tenantId
                 && x.AttendanceDate == request.AttendanceDate,
            cancellationToken);

        if (record is null)
        {
            record = new AttendanceRecord
            {
                HostelId = hostelId,
                TenantId = tenantId,
                AttendanceDate = request.AttendanceDate,
                Status = status,
                Notes = request.Notes?.Trim()
            };

            _db.AttendanceRecords.Add(record);
        }
        else
        {
            record.Status = status;
            record.Notes = request.Notes?.Trim();
        }

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Saved attendance for tenant {TenantId} on {AttendanceDate}: {Status}",
            tenantId,
            request.AttendanceDate,
            status);

        return Ok(new
        {
            record.Id,
            record.HostelId,
            record.TenantId,
            record.AttendanceDate,
            record.Status,
            record.Notes
        });
    }
}

public sealed class SaveAttendanceRequest
{
    public DateOnly AttendanceDate { get; set; }

    [Required]
    public string Status { get; set; } = "";

    [StringLength(500)]
    public string? Notes { get; set; }
}