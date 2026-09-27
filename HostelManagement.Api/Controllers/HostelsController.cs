using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
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
            .Where(hostel => hostel.IsActive)
            .OrderBy(hostel => hostel.Name)
            .Select(hostel => new
            {
                hostel.Id,
                hostel.Name,
                hostel.Address,
                hostel.Phone,
                hostel.Email,
                hostel.TimezoneName,
                hostel.IsActive
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
            .Where(hostel => hostel.Id == id)
            .Select(hostel => new
            {
                hostel.Id,
                hostel.Name,
                hostel.Address,
                hostel.Phone,
                hostel.Email,
                hostel.TimezoneName,
                hostel.IsActive
            })
            .FirstOrDefaultAsync(cancellationToken);

        return hostel is null
            ? NotFound(new { message = "Hostel not found." })
            : Ok(hostel);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create(
        CreateHostelRequest request,
        CancellationToken cancellationToken)
    {
        var userIdText =
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue("user_id")
            ?? User.FindFirstValue("userId");

        if (!long.TryParse(userIdText, out var userId))
        {
            return Unauthorized(new
            {
                message = "The access token does not contain a valid user ID. Sign in again."
            });
        }

        var adminRole = await _db.Roles
            .FirstOrDefaultAsync(role => role.Name == "Admin", cancellationToken);

        if (adminRole is null)
        {
            return Problem(
                title: "Admin role is missing",
                detail: "Add an Admin row to the roles table before creating hostels.");
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        var hostel = new Hostel
        {
            Name = request.Name.Trim(),
            Address = request.Address?.Trim(),
            Phone = request.Phone?.Trim(),
            Email = request.Email?.Trim(),
            TimezoneName = string.IsNullOrWhiteSpace(request.TimezoneName)
                ? "Asia/Kolkata"
                : request.TimezoneName.Trim(),
            IsActive = true
        };

        _db.Hostels.Add(hostel);
        await _db.SaveChangesAsync(cancellationToken);

        // Give the Admin who created this hostel access to it.
        _db.UserHostelRoles.Add(new UserHostelRole
        {
            UserId = userId,
            HostelId = hostel.Id,
            RoleId = adminRole.Id,
            CreatedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation(
            "Created hostel {HostelId} for Admin user {UserId}",
            hostel.Id,
            userId);

        return CreatedAtAction(
            nameof(GetById),
            new { id = hostel.Id },
            new
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
}

public sealed class CreateHostelRequest
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

    [StringLength(80)]
    public string? TimezoneName { get; set; }
}