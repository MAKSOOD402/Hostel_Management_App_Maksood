using System.Text.Json;
using System.Text.RegularExpressions;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/hostels/{hostelId:long}/settings")]
public class HostelSettingsController : ControllerBase
{
    private static readonly Regex ValidKey =
        new("^[a-zA-Z][a-zA-Z0-9_-]{0,99}$", RegexOptions.Compiled);

    private readonly HostelDbContext _db;
    private readonly ILogger<HostelSettingsController> _logger;

    public HostelSettingsController(
        HostelDbContext db,
        ILogger<HostelSettingsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // GET /api/hostels/1/settings
    [HttpGet]
    public async Task<IActionResult> GetAll(
        long hostelId,
        CancellationToken cancellationToken)
    {
        var exists = await _db.Hostels
            .AnyAsync(h => h.Id == hostelId, cancellationToken);

        if (!exists)
            return NotFound(new { message = "Hostel not found." });

        var settings = await _db.HostelSettings
            .AsNoTracking()
            .Where(s => s.HostelId == hostelId)
            .OrderBy(s => s.SettingKey)
            .ToListAsync(cancellationToken);

        return Ok(settings.Select(s => new
        {
            s.SettingKey,
            value = s.SettingValue.RootElement,
            s.UpdatedAt
        }));
    }

    // PUT /api/hostels/1/settings/billingDefaults
    [HttpPut("{key}")]
    public async Task<IActionResult> Save(
        long hostelId,
        string key,
        SaveHostelSettingRequest request,
        CancellationToken cancellationToken)
    {
        if (!ValidKey.IsMatch(key))
        {
            return BadRequest(new
            {
                message = "Setting key must start with a letter and contain only letters, numbers, _ or -."
            });
        }

        var exists = await _db.Hostels
            .AnyAsync(h => h.Id == hostelId, cancellationToken);

        if (!exists)
            return NotFound(new { message = "Hostel not found." });

        var setting = await _db.HostelSettings.FirstOrDefaultAsync(
            s => s.HostelId == hostelId && s.SettingKey == key,
            cancellationToken);

        var json = JsonDocument.Parse(request.Value.GetRawText());

        if (setting is null)
        {
            setting = new HostelSetting
            {
                HostelId = hostelId,
                SettingKey = key,
                SettingValue = json
            };

            _db.HostelSettings.Add(setting);
        }
        else
        {
            setting.SettingValue.Dispose();
            setting.SettingValue = json;
        }

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Saved setting {SettingKey} for hostel {HostelId}",
            key,
            hostelId);

        return Ok(new
        {
            setting.HostelId,
            setting.SettingKey,
            value = setting.SettingValue.RootElement,
            setting.UpdatedAt
        });
    }

    // DELETE /api/hostels/1/settings/billingDefaults
    [HttpDelete("{key}")]
    public async Task<IActionResult> Delete(
        long hostelId,
        string key,
        CancellationToken cancellationToken)
    {
        var setting = await _db.HostelSettings.FirstOrDefaultAsync(
            s => s.HostelId == hostelId && s.SettingKey == key,
            cancellationToken);

        if (setting is null)
            return NotFound(new { message = "Setting not found." });

        _db.HostelSettings.Remove(setting);
        await _db.SaveChangesAsync(cancellationToken);

        setting.SettingValue.Dispose();

        _logger.LogInformation(
            "Deleted setting {SettingKey} for hostel {HostelId}",
            key,
            hostelId);

        return NoContent();
    }
}

public sealed class SaveHostelSettingRequest
{
    public JsonElement Value { get; set; }
}