using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HostelManagement.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/hostels/{hostelId:long}/admins")]
public sealed class HostelAdminsController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly ILogger<HostelAdminsController> _logger;

    public HostelAdminsController(
        HostelDbContext db,
        IPasswordHasher<AppUser> passwordHasher,
        ILogger<HostelAdminsController> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> CreateAdmin(
        long hostelId,
        CreateHostelAdminRequest request,
        CancellationToken cancellationToken)
    {
        var hostelExists = await _db.Hostels.AnyAsync(
            hostel => hostel.Id == hostelId && hostel.IsActive,
            cancellationToken);

        if (!hostelExists)
            return NotFound(new { message = "Active hostel not found." });

        var email = request.Email.Trim().ToLowerInvariant();
        var emailExists = await _db.AppUsers.AnyAsync(
            user => user.Email.ToLower() == email,
            cancellationToken);

        if (emailExists)
        {
            return Conflict(new
            {
                message = "That email already has an account. Use a new email for this Admin account."
            });
        }

        var adminRole = await _db.Roles.FirstOrDefaultAsync(
            role => role.Name == "Admin",
            cancellationToken);

        if (adminRole is null)
            return Problem("The Admin role is missing from the roles table.");

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        var user = new AppUser
        {
            Email = email,
            FullName = request.FullName.Trim(),
            Phone = request.Phone?.Trim(),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            PasswordHash = ""
        };

        user.PasswordHash =
            _passwordHasher.HashPassword(user, request.Password);

        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync(cancellationToken);

        _db.UserHostelRoles.Add(new UserHostelRole
        {
            UserId = user.Id,
            HostelId = hostelId,
            RoleId = adminRole.Id,
            CreatedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation(
            "Created Admin user {UserId} for hostel {HostelId}",
            user.Id,
            hostelId);

        return StatusCode(StatusCodes.Status201Created, new
        {
            user.Id,
            user.Email,
            user.FullName,
            HostelId = hostelId,
            Role = "Admin"
        });
    }
}

public sealed class CreateHostelAdminRequest
{
    [Required]
    [EmailAddress]
    [StringLength(254, MinimumLength = 5)]
    public string Email { get; set; } = "";

    [Required]
    [StringLength(150, MinimumLength = 2)]
    [RegularExpression(@"^[\p{L}\p{M}][\p{L}\p{M} .'-]*$",
        ErrorMessage = "Name may contain letters, spaces, periods, apostrophes, or hyphens.")]
    public string FullName { get; set; } = "";

    [StringLength(16)]
    [RegularExpression(@"^(?:[0-9]{10}|\+[1-9][0-9]{7,14})$",
        ErrorMessage = "Phone must be 10 digits or an international number beginning with +.")]
    public string? Phone { get; set; }

    [Required]
    [StringLength(128, MinimumLength = 12)]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}$",
        ErrorMessage = "Password must include lowercase, uppercase, a number, and a symbol.")]
    public string Password { get; set; } = "";
}
