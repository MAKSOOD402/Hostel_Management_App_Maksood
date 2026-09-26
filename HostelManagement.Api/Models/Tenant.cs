namespace HostelManagement.Api.Models;

public class Tenant
{
    public long Id { get; set; }
    public long HostelId { get; set; }
    public long? UserId { get; set; }
    public long? RoomId { get; set; }
    public required string FullName { get; set; }
    public required string PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? EmergencyName { get; set; }
    public string? EmergencyPhone { get; set; }
    public DateOnly MoveInDate { get; set; }
    public DateOnly? MoveOutDate { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}