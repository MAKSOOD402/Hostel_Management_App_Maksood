namespace HostelManagement.Api.Models;

public class Room
{
    public long Id { get; set; }
    public long HostelId { get; set; }
    public required string RoomNumber { get; set; }
    public int Capacity { get; set; }
    public int? FloorNumber { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}