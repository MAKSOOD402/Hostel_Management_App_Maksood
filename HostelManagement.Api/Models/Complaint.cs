namespace HostelManagement.Api.Models;

public class Complaint
{
    public long Id { get; set; }
    public long HostelId { get; set; }
    public long TenantId { get; set; }
    public long? RoomId { get; set; }
    public required string Title { get; set; }
    public required string Description { get; set; }
    public string Category { get; set; } = "General";
    public string Status { get; set; } = "Open";
    public string Priority { get; set; } = "Normal";
    public long? AssignedToUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
}