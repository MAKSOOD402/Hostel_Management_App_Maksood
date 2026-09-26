using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HostelManagement.Api.Controllers;

[Authorize(Roles = "Tenant")]
[ApiController]
[Route("api/tenant-portal")]
public class TenantPortalController : ControllerBase
{
    private static readonly string[] AllowedPriorities =
        ["Low", "Normal", "High", "Urgent"];

    private readonly HostelDbContext _db;
    private readonly ILogger<TenantPortalController> _logger;

    public TenantPortalController(
        HostelDbContext db,
        ILogger<TenantPortalController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet("bills")]
    public async Task<IActionResult> GetBills(
        CancellationToken cancellationToken)
    {
        if (!TryGetScope(out var tenantId, out var hostelId))
            return Forbid();

        var bills = await _db.Bills
            .AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.HostelId == hostelId)
            .OrderByDescending(b => b.DueDate)
            .Select(b => new
            {
                b.Id,
                b.BillNumber,
                b.PeriodStart,
                b.PeriodEnd,
                b.IssueDate,
                b.DueDate,
                b.TotalAmount,
                b.Status,
                b.PaidAt
            })
            .ToListAsync(cancellationToken);

        return Ok(bills);
    }

    [HttpGet("complaints")]
    public async Task<IActionResult> GetComplaints(
        CancellationToken cancellationToken)
    {
        if (!TryGetScope(out var tenantId, out var hostelId))
            return Forbid();

        var complaints = await _db.Complaints
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.HostelId == hostelId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Title,
                c.Description,
                c.Category,
                c.Status,
                c.Priority,
                c.CreatedAt,
                c.UpdatedAt,
                c.ResolvedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(complaints);
    }

    [HttpPost("complaints")]
    public async Task<IActionResult> CreateComplaint(
        CreateTenantComplaintRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetScope(out var tenantId, out var hostelId))
            return Forbid();

        var tenant = await _db.Tenants
            .AsNoTracking()
            .Where(t =>
                t.Id == tenantId &&
                t.HostelId == hostelId &&
                t.IsActive)
            .Select(t => new { t.Id, t.RoomId })
            .FirstOrDefaultAsync(cancellationToken);

        if (tenant is null)
            return Forbid();

        if (!AllowedPriorities.Contains(
                request.Priority,
                StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = "Priority must be Low, Normal, High, or Urgent."
            });
        }

        var priority = AllowedPriorities.First(p =>
            string.Equals(p, request.Priority, StringComparison.OrdinalIgnoreCase));

        var complaint = new Complaint
        {
            HostelId = hostelId,
            TenantId = tenant.Id,
            RoomId = tenant.RoomId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category)
                ? "General"
                : request.Category.Trim(),
            Priority = priority,
            Status = "Open"
        };

        _db.Complaints.Add(complaint);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Tenant {TenantId} submitted complaint {ComplaintId}",
            tenantId,
            complaint.Id);

        return Created(
            $"/api/tenant-portal/complaints/{complaint.Id}",
            new
            {
                complaint.Id,
                complaint.Title,
                complaint.Status,
                complaint.Priority,
                complaint.CreatedAt
            });
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetScope(out var tenantId, out var hostelId))
            return Forbid();

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Notifications
            .AsNoTracking()
            .Where(n => n.TenantId == tenantId && n.HostelId == hostelId);

        if (unreadOnly)
            query = query.Where(n => n.ReadAt == null);

        var totalCount = await query.CountAsync(cancellationToken);

        var notifications = await query
            .OrderByDescending(n => n.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new
            {
                n.Id,
                n.BillId,
                n.Channel,
                n.Title,
                n.Message,
                n.ReadAt,
                n.SentAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            page,
            pageSize,
            totalCount,
            notifications
        });
    }

    [HttpPatch("notifications/{notificationId:long}/read")]
    public async Task<IActionResult> MarkNotificationRead(
        long notificationId,
        CancellationToken cancellationToken)
    {
        if (!TryGetScope(out var tenantId, out var hostelId))
            return Forbid();

        var notification = await _db.Notifications.FirstOrDefaultAsync(
            n => n.Id == notificationId
                 && n.TenantId == tenantId
                 && n.HostelId == hostelId,
            cancellationToken);

        if (notification is null)
            return NotFound(new { message = "Notification not found." });

        if (notification.ReadAt is null)
        {
            notification.ReadAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return Ok(new
        {
            notification.Id,
            notification.ReadAt
        });
    }

    private bool TryGetScope(out long tenantId, out long hostelId)
    {
        tenantId = 0;
        hostelId = 0;

        return long.TryParse(
                   User.FindFirst("tenant_id")?.Value,
                   out tenantId)
               && long.TryParse(
                   User.FindFirst("hostel_id")?.Value,
                   out hostelId);
    }
}

public sealed class CreateTenantComplaintRequest
{
    [Required]
    [StringLength(180, MinimumLength = 3)]
    public string Title { get; set; } = "";

    [Required]
    [StringLength(5000, MinimumLength = 5)]
    public string Description { get; set; } = "";

    [StringLength(50)]
    public string? Category { get; set; }

    [Required]
    public string Priority { get; set; } = "Normal";
}