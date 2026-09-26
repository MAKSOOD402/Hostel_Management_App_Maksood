namespace HostelManagement.Api.Models;

public class ReminderSchedule
{
    public long Id { get; set; }
    public long BillId { get; set; }
    public required string Channel { get; set; }
    public DateTimeOffset ScheduledAt { get; set; }
    public string Status { get; set; } = "Scheduled";
    public int AttemptCount { get; set; }
    public string? LastError { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}