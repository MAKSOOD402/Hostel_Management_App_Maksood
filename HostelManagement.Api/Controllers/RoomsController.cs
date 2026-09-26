using HostelManagement.Api.Data;
using HostelManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/rooms")]
public class RoomsController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly ILogger<RoomsController> _logger;

    public RoomsController(
        HostelDbContext db,
        ILogger<RoomsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        long hostelId,
        CancellationToken cancellationToken)
    {
        var rooms = await _db.Rooms
            .AsNoTracking()
            .Where(x => x.HostelId == hostelId)
            .OrderBy(x => x.RoomNumber)
            .Select(x => new
            {
                x.Id,
                x.HostelId,
                x.RoomNumber,
                x.Capacity,
                x.FloorNumber,
                x.Notes,
                x.IsActive
            })
            .ToListAsync(cancellationToken);

        return Ok(rooms);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        long hostelId,
        CreateRoomRequest request,
        CancellationToken cancellationToken)
    {
        var hostelExists = await _db.Hostels
            .AnyAsync(x => x.Id == hostelId && x.IsActive, cancellationToken);

        if (!hostelExists)
            return NotFound(new { message = "Hostel not found." });

        var roomNumber = request.RoomNumber.Trim();

        var duplicate = await _db.Rooms.AnyAsync(
            x => x.HostelId == hostelId && x.RoomNumber == roomNumber,
            cancellationToken);

        if (duplicate)
            return Conflict(new { message = "Room number already exists in this hostel." });

        var room = new Room
        {
            HostelId = hostelId,
            RoomNumber = roomNumber,
            Capacity = request.Capacity,
            FloorNumber = request.FloorNumber,
            Notes = request.Notes?.Trim()
        };

        _db.Rooms.Add(room);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Created room {RoomId} in hostel {HostelId}",
            room.Id,
            hostelId);

        return Created(
            $"/api/hostels/{hostelId}/rooms/{room.Id}",
            new { room.Id, room.HostelId, room.RoomNumber, room.Capacity, room.IsActive });
    }

    [HttpPut("{roomId:long}")]
    public async Task<IActionResult> Update(
        long hostelId,
        long roomId,
        UpdateRoomRequest request,
        CancellationToken cancellationToken)
    {
        var room = await _db.Rooms.FirstOrDefaultAsync(
            x => x.Id == roomId && x.HostelId == hostelId,
            cancellationToken);

        if (room is null)
            return NotFound(new { message = "Room not found." });

        var roomNumber = request.RoomNumber.Trim();

        var duplicate = await _db.Rooms.AnyAsync(
            x => x.HostelId == hostelId
                 && x.Id != roomId
                 && x.RoomNumber == roomNumber,
            cancellationToken);

        if (duplicate)
            return Conflict(new { message = "Room number already exists in this hostel." });

        var occupancy = await _db.Tenants.CountAsync(
            x => x.RoomId == roomId && x.IsActive,
            cancellationToken);

        if (request.Capacity < occupancy)
            return Conflict(new { message = "Capacity cannot be below current occupancy." });

        room.RoomNumber = roomNumber;
        room.Capacity = request.Capacity;
        room.FloorNumber = request.FloorNumber;
        room.Notes = request.Notes?.Trim();
        room.IsActive = request.IsActive;

        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Updated room {RoomId} in hostel {HostelId}",
            roomId,
            hostelId);

        return Ok(new { room.Id, room.HostelId, room.RoomNumber, room.Capacity, room.IsActive });
    }

    [HttpDelete("{roomId:long}")]
    public async Task<IActionResult> Deactivate(
        long hostelId,
        long roomId,
        CancellationToken cancellationToken)
    {
        var room = await _db.Rooms.FirstOrDefaultAsync(
            x => x.Id == roomId && x.HostelId == hostelId,
            cancellationToken);

        if (room is null)
            return NotFound(new { message = "Room not found." });

        var occupied = await _db.Tenants.AnyAsync(
            x => x.RoomId == roomId && x.IsActive,
            cancellationToken);

        if (occupied)
            return Conflict(new { message = "Move active tenants before deactivating this room." });

        room.IsActive = false;
        await _db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }
}

public sealed record CreateRoomRequest(
    string RoomNumber,
    int Capacity,
    int? FloorNumber,
    string? Notes);

public sealed record UpdateRoomRequest(
    string RoomNumber,
    int Capacity,
    int? FloorNumber,
    string? Notes,
    bool IsActive);