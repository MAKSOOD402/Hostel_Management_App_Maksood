using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/reminders")]
public class RemindersController : ControllerBase
{
    private static readonly HashSet<string> AllowedChannels =
        ["InApp", "Email", "SMS", "Push"];

    private readonly HostelDbContext _db;
    private readonly ILogger<RemindersController> _logger;

    public RemindersController(
        HostelDbContext db,
        ILogger<RemindersController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // GET: /api/hostels/1/reminders
    [HttpGet]
    public async Task<IActionResult> GetAll(
        long hostelId,
        CancellationToken cancellationToken)
    {
        var reminders = await (
            from reminder in _db.ReminderSchedules.AsNoTracking()
            join bill in _db.Bills.AsNoTracking()
                on reminder.BillId equals bill.Id
            where bill.HostelId == hostelId
            orderby reminder.ScheduledAt descending
            select new
            {
                reminder.Id,
                reminder.BillId,
                bill.BillNumber,
                BillStatus = bill.Status,
                reminder.Channel,
                reminder.ScheduledAt,
                ReminderStatus = reminder.Status,
                reminder.AttemptCount,
                reminder.ProcessedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(reminders);
    }

    // POST: /api/hostels/1/reminders
    [HttpPost]
    public async Task<IActionResult> Schedule(
        long hostelId,
        ScheduleReminderRequest request,
        CancellationToken cancellationToken)
    {
        if (!AllowedChannels.Contains(request.Channel))
        {
            return BadRequest(new
            {
                message = "Channel must be InApp, Email, SMS, or Push."
            });
        }

        var bill = await _db.Bills
            .AsNoTracking()
            .Where(b => b.HostelId == hostelId && b.Id == request.BillId)
            .Select(b => new { b.Id, b.Status, b.DueDate })
            .FirstOrDefaultAsync(cancellationToken);

        if (bill is null)
            return NotFound(new { message = "Bill not found." });

        if (bill.Status is "Paid" or "Cancelled")
        {
            return Conflict(new
            {
                message = $"Cannot schedule a reminder for a {bill.Status} bill."
            });
        }

        var reminder = new ReminderSchedule
        {
            BillId = bill.Id,
            Channel = request.Channel,
            ScheduledAt = request.ScheduledAt.ToUniversalTime(),
            Status = "Scheduled"
        };

        _db.ReminderSchedules.Add(reminder);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Conflict(new
            {
                message = "A reminder already exists for this bill, channel, and scheduled time."
            });
        }

        _logger.LogInformation(
            "Scheduled reminder {ReminderId} for bill {BillId} at {ScheduledAt}",
            reminder.Id,
            reminder.BillId,
            reminder.ScheduledAt);

        return Created(
            $"/api/hostels/{hostelId}/reminders/{reminder.Id}",
            new
            {
                reminder.Id,
                reminder.BillId,
                reminder.Channel,
                reminder.ScheduledAt,
                reminder.Status
            });
    }

    // DELETE: /api/hostels/1/reminders/3
    [HttpDelete("{reminderId:long}")]
    public async Task<IActionResult> Cancel(
        long hostelId,
        long reminderId,
        CancellationToken cancellationToken)
    {
        var reminder = await (
            from r in _db.ReminderSchedules
            join bill in _db.Bills on r.BillId equals bill.Id
            where r.Id == reminderId && bill.HostelId == hostelId
            select r)
            .FirstOrDefaultAsync(cancellationToken);

        if (reminder is null)
            return NotFound(new { message = "Reminder not found." });

        if (reminder.Status != "Scheduled")
        {
            return Conflict(new
            {
                message = $"Only Scheduled reminders can be cancelled. Current status: {reminder.Status}."
            });
        }

        reminder.Status = "Cancelled";
        reminder.ProcessedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Cancelled reminder {ReminderId} for bill {BillId}",
            reminder.Id,
            reminder.BillId);

        return NoContent();
    }
}

public sealed class ScheduleReminderRequest
{
    [Range(1, long.MaxValue)]
    public long BillId { get; set; }

    [Required]
    public string Channel { get; set; } = "InApp";

    public DateTimeOffset ScheduledAt { get; set; }
}