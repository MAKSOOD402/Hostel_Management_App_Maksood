namespace HostelManagement.Api.Models;

public class Notification
{
    public long Id { get; set; }
    public long HostelId { get; set; }
    public long? TenantId { get; set; }
    public long? BillId { get; set; }
    public required string Channel { get; set; }
    public required string Title { get; set; }
    public required string Message { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
    public DateTimeOffset SentAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}