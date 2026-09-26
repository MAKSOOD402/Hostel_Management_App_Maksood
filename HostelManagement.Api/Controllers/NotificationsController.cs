using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/tenants/{tenantId:long}/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        HostelDbContext db,
        ILogger<NotificationsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // GET /api/hostels/1/tenants/2/notifications?unreadOnly=true
    [HttpGet]
    public async Task<IActionResult> GetAll(
        long hostelId,
        long tenantId,
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Notifications
            .AsNoTracking()
            .Where(n => n.HostelId == hostelId && n.TenantId == tenantId);

        if (unreadOnly)
            query = query.Where(n => n.ReadAt == null);

        var totalCount = await query.CountAsync(cancellationToken);

        var notifications = await query
            .OrderByDescending(n => n.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NotificationResponse(
                n.Id,
                n.BillId,
                n.Channel,
                n.Title,
                n.Message,
                n.ReadAt,
                n.SentAt))
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            page,
            pageSize,
            totalCount,
            notifications
        });
    }

    // PATCH /api/hostels/1/tenants/2/notifications/5/read
    [HttpPatch("{notificationId:long}/read")]
    public async Task<IActionResult> MarkRead(
        long hostelId,
        long tenantId,
        long notificationId,
        CancellationToken cancellationToken)
    {
        var notification = await _db.Notifications.FirstOrDefaultAsync(
            n => n.Id == notificationId
                 && n.HostelId == hostelId
                 && n.TenantId == tenantId,
            cancellationToken);

        if (notification is null)
            return NotFound(new { message = "Notification not found." });

        if (notification.ReadAt is null)
        {
            notification.ReadAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Marked notification {NotificationId} read for tenant {TenantId}",
                notificationId,
                tenantId);
        }

        return Ok(new
        {
            notification.Id,
            notification.ReadAt
        });
    }
}

public sealed record NotificationResponse(
    long Id,
    long? BillId,
    string Channel,
    string Title,
    string Message,
    DateTimeOffset? ReadAt,
    DateTimeOffset SentAt);