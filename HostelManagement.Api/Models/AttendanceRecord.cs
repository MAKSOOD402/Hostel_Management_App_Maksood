namespace HostelManagement.Api.Models;

public class AttendanceRecord
{
    public long Id { get; set; }
    public long HostelId { get; set; }
    public long TenantId { get; set; }
    public DateOnly AttendanceDate { get; set; }
    public required string Status { get; set; }
    public string? Notes { get; set; }
    public long? RecordedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}