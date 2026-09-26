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
[Route("api/hostels/{hostelId:long}/staff-accounts")]
public class StaffAccountsController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly ILogger<StaffAccountsController> _logger;

    public StaffAccountsController(
        HostelDbContext db,
        IPasswordHasher<AppUser> passwordHasher,
        ILogger<StaffAccountsController> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        long hostelId,
        CancellationToken cancellationToken)
    {
        var staff = await (
            from link in _db.UserHostelRoles.AsNoTracking()
            join role in _db.Roles.AsNoTracking()
                on link.RoleId equals role.Id
            join user in _db.AppUsers.AsNoTracking()
                on link.UserId equals user.Id
            where link.HostelId == hostelId && role.Name == "Staff"
            orderby user.FullName
            select new
            {
                user.Id,
                user.Email,
                user.FullName,
                user.Phone,
                user.IsActive,
                user.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(staff);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        long hostelId,
        CreateStaffAccountRequest request,
        CancellationToken cancellationToken)
    {
        var hostelExists = await _db.Hostels.AnyAsync(
            h => h.Id == hostelId && h.IsActive,
            cancellationToken);

        if (!hostelExists)
            return NotFound(new { message = "Active hostel not found." });

        var staffRole = await _db.Roles.FirstOrDefaultAsync(
            r => r.Name == "Staff",
            cancellationToken);

        if (staffRole is null)
        {
            return StatusCode(500, new
            {
                message = "Staff role is missing. Run the database schema script."
            });
        }

        var email = request.Email.Trim().ToLowerInvariant();

        var emailExists = await _db.AppUsers.AnyAsync(
            u => u.Email.ToLower() == email,
            cancellationToken);

        if (emailExists)
        {
            return Conflict(new
            {
                message = "An account with this email already exists."
            });
        }

        var now = DateTimeOffset.UtcNow;

        var user = new AppUser
        {
            Email = email,
            FullName = request.FullName.Trim(),
            Phone = request.Phone?.Trim(),
            PasswordHash = "",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            _db.AppUsers.Add(user);
            await _db.SaveChangesAsync(cancellationToken);

            _db.UserHostelRoles.Add(new UserHostelRole
            {
                UserId = user.Id,
                HostelId = hostelId,
                RoleId = staffRole.Id
            });

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);

            return Conflict(new
            {
                message = "Could not create the staff account. The email may already be in use."
            });
        }

        _logger.LogInformation(
            "Created staff account {UserId} for hostel {HostelId}",
            user.Id,
            hostelId);

        return Created(
            $"/api/hostels/{hostelId}/staff-accounts/{user.Id}",
            new
            {
                userId = user.Id,
                hostelId,
                user.Email,
                user.FullName,
                role = "Staff"
            });
    }

    [HttpDelete("{userId:long}")]
    public async Task<IActionResult> RevokeAccess(
        long hostelId,
        long userId,
        CancellationToken cancellationToken)
    {
        var staffRole = await _db.Roles.FirstOrDefaultAsync(
            r => r.Name == "Staff",
            cancellationToken);

        if (staffRole is null)
        {
            return StatusCode(500, new
            {
                message = "Staff role is missing."
            });
        }

        var membership = await _db.UserHostelRoles.FirstOrDefaultAsync(
            link => link.UserId == userId
                    && link.HostelId == hostelId
                    && link.RoleId == staffRole.Id,
            cancellationToken);

        if (membership is null)
            return NotFound(new { message = "Staff account not found for this hostel." });

        _db.UserHostelRoles.Remove(membership);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Revoked Staff access for user {UserId} from hostel {HostelId}",
            userId,
            hostelId);

        return NoContent();
    }
}

public sealed class CreateStaffAccountRequest
{
    [Required]
    [EmailAddress]
    [StringLength(254)]
    public string Email { get; set; } = "";

    [Required]
    [StringLength(150, MinimumLength = 2)]
    public string FullName { get; set; } = "";

    [StringLength(30)]
    public string? Phone { get; set; }

    [Required]
    [MinLength(12)]
    public string Password { get; set; } = "";
}