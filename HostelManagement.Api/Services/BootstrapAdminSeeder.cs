using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HostelManagement.Api.Services;

public static class BootstrapAdminSeeder
{
    public static async Task SeedAsync(
        IServiceProvider services,
        IConfiguration configuration)
    {
        var email = configuration["BootstrapAdmin:Email"]?.Trim();
        var password = configuration["BootstrapAdmin:Password"];
        var fullName = configuration["BootstrapAdmin:FullName"]?.Trim();
        var hostelName = configuration["BootstrapAdmin:HostelName"]?.Trim();

        if (string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrWhiteSpace(password) ||
            string.IsNullOrWhiteSpace(fullName) ||
            string.IsNullOrWhiteSpace(hostelName))
        {
            throw new InvalidOperationException(
                "Set BootstrapAdmin:Email, Password, FullName, and HostelName.");
        }

        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HostelDbContext>();
        var passwordHasher =
            scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();

        await using var transaction = await db.Database.BeginTransactionAsync();

        var adminRole = await db.Roles
            .FirstOrDefaultAsync(role => role.Name == "Admin");

        if (adminRole is null)
        {
            adminRole = new Role { Name = "Admin" };
            db.Roles.Add(adminRole);
            await db.SaveChangesAsync();
        }

        var hostel = await db.Hostels
            .FirstOrDefaultAsync(item => item.Name == hostelName);

        if (hostel is null)
        {
            hostel = new Hostel
            {
                Name = hostelName,
                TimezoneName = "Asia/Kolkata",
                IsActive = true
            };

            db.Hostels.Add(hostel);
            await db.SaveChangesAsync();
        }

        var normalizedEmail = email.ToLowerInvariant();
        var user = await db.AppUsers
            .FirstOrDefaultAsync(item => item.Email.ToLower() == normalizedEmail);

        if (user is null)
        {
            user = new AppUser
            {
                Email = email,
                FullName = fullName,
                PasswordHash = "",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            user.PasswordHash =
                passwordHasher.HashPassword(user, password);

            db.AppUsers.Add(user);
            await db.SaveChangesAsync();
        }

        var hasAccess = await db.UserHostelRoles.AnyAsync(access =>
            access.UserId == user.Id &&
            access.HostelId == hostel.Id &&
            access.RoleId == adminRole.Id);

        if (!hasAccess)
        {
            db.UserHostelRoles.Add(new UserHostelRole
            {
                UserId = user.Id,
                HostelId = hostel.Id,
                RoleId = adminRole.Id,
                CreatedAt = DateTimeOffset.UtcNow
            });

            await db.SaveChangesAsync();
        }

        await transaction.CommitAsync();
    }
}