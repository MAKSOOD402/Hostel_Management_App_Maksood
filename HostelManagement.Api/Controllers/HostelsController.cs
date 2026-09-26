using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HostelManagement.Api.Controllers;

[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels")]
public class HostelsController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly ILogger<HostelsController> _logger;

    public HostelsController(
        HostelDbContext db,
        ILogger<HostelsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        CancellationToken cancellationToken)
    {
        var hostels = await _db.Hostels
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Address,
                x.Phone,
                x.Email,
                x.TimezoneName,
                x.IsActive
            })
            .ToListAsync(cancellationToken);

        return Ok(hostels);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(
        long id,
        CancellationToken cancellationToken)
    {
        var hostel = await _db.Hostels
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Address,
                x.Phone,
                x.Email,
                x.TimezoneName,
                x.IsActive
            })
            .FirstOrDefaultAsync(cancellationToken);

        return hostel is null
            ? NotFound(new { message = "Hostel not found." })
            : Ok(hostel);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(
        long id,
        UpdateHostelProfileRequest request,
        CancellationToken cancellationToken)
    {
        var hostel = await _db.Hostels.FirstOrDefaultAsync(
            h => h.Id == id,
            cancellationToken);

        if (hostel is null)
            return NotFound(new { message = "Hostel not found." });

        hostel.Name = request.Name.Trim();
        hostel.Address = request.Address?.Trim();
        hostel.Phone = request.Phone?.Trim();
        hostel.Email = request.Email?.Trim();
        hostel.TimezoneName = request.TimezoneName.Trim();

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Updated hostel profile for hostel {HostelId}",
            id);

        return Ok(new
        {
            hostel.Id,
            hostel.Name,
            hostel.Address,
            hostel.Phone,
            hostel.Email,
            hostel.TimezoneName,
            hostel.IsActive
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        CreateHostelRequest request,
        CancellationToken cancellationToken)
    {
        var hostel = new Hostel
        {
            Name = request.Name.Trim(),
            Address = request.Address?.Trim(),
            Phone = request.Phone?.Trim(),
            Email = request.Email?.Trim(),
            TimezoneName = request.TimezoneName?.Trim() ?? "Asia/Kolkata"
        };

        _db.Hostels.Add(hostel);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Created hostel {HostelId} named {HostelName}",
            hostel.Id,
            hostel.Name);

        return CreatedAtAction(
            nameof(GetById),
            new { id = hostel.Id },
            new { hostel.Id, hostel.Name, hostel.Address, hostel.IsActive });
    }
}

public sealed record CreateHostelRequest(
    string Name,
    string? Address,
    string? Phone,
    string? Email,
    string? TimezoneName);

public sealed class UpdateHostelProfileRequest
{
    [Required]
    [StringLength(150, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [StringLength(500)]
    public string? Address { get; set; }

    [StringLength(30)]
    public string? Phone { get; set; }

    [EmailAddress]
    [StringLength(254)]
    public string? Email { get; set; }

    [Required]
    [StringLength(100)]
    public string TimezoneName { get; set; } = "Asia/Kolkata";
}