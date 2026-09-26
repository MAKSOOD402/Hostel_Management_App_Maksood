namespace HostelManagement.Api.Models;

public class UserHostelRole
{
    public long UserId { get; set; }
    public long HostelId { get; set; }
    public short RoleId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}