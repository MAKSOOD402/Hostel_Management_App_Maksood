using System.Text.Json;

namespace HostelManagement.Api.Models;

public class HostelSetting
{
    public long Id { get; set; }
    public long HostelId { get; set; }
    public required string SettingKey { get; set; }
    public required JsonDocument SettingValue { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}