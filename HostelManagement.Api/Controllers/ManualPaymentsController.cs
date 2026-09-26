using System.ComponentModel.DataAnnotations;
using HostelManagement.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HostelManagement.Api.Controllers;

[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/hostels/{hostelId:long}/bills/{billId:long}/manual-payments")]
public sealed class ManualPaymentsController : ControllerBase
{
    private static readonly HashSet<string> AllowedMethods =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "Cash",
            "BankTransfer",
            "UPI",
            "Card",
            "NetBanking",
            "Other"
        };

    private readonly HostelDbContext _db;
    private readonly ILogger<ManualPaymentsController> _logger;

    public ManualPaymentsController(
        HostelDbContext db,
        ILogger<ManualPaymentsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // POST /api/hostels/1/bills/12/manual-payments
    [HttpPost]
    public async Task<IActionResult> Record(
        long hostelId,
        long billId,
        RecordManualPaymentRequest request,
        CancellationToken cancellationToken)
    {
        var paymentMethod = AllowedMethods.FirstOrDefault(
            method => string.Equals(
                method,
                request.PaymentMethod.Trim(),
                StringComparison.OrdinalIgnoreCase));

        if (paymentMethod is null)
        {
            return BadRequest(new
            {
                message = "PaymentMethod must be Cash, BankTransfer, UPI, Card, NetBanking, or Other."
            });
        }

        var billExists = await _db.Bills.AnyAsync(
            bill => bill.Id == billId && bill.HostelId == hostelId,
            cancellationToken);

        if (!billExists)
        {
            return NotFound(new { message = "Bill not found." });
        }

        // The payment function uses this as its payment reference. Generate one
        // for cash payments when the staff member has no external reference.
        var paymentReference = string.IsNullOrWhiteSpace(request.ReferenceNumber)
            ? $"MANUAL-{Guid.NewGuid():N}"
            : request.ReferenceNumber.Trim();

        var receiptNumber = $"RCT-{Guid.NewGuid():N}";

        try
        {
            var paymentId = await _db.Database
                .SqlQuery<long>($"""
                    SELECT record_successful_payment(
                        {hostelId},
                        {billId},
                        {request.Amount},
                        {paymentMethod},
                        {"Manual"},
                        {paymentReference},
                        {receiptNumber}
                    ) AS "Value"
                    """)
                .SingleAsync(cancellationToken);

            _logger.LogInformation(
                "Recorded manual payment {PaymentId} of {Amount} for bill {BillId} in hostel {HostelId} using {PaymentMethod}",
                paymentId,
                request.Amount,
                billId,
                hostelId,
                paymentMethod);

            return Ok(new
            {
                message = "Manual payment recorded.",
                paymentId,
                hostelId,
                billId,
                amount = request.Amount,
                paymentMethod,
                paymentReference,
                receiptNumber
            });
        }
        catch (PostgresException ex) when (
            ex.SqlState == "P0001" || ex.SqlState == "23505")
        {
            _logger.LogWarning(
                ex,
                "Could not record manual payment for bill {BillId}",
                billId);

            return Conflict(new { message = ex.MessageText });
        }
    }
}

public sealed class RecordManualPaymentRequest
{
    [Range(typeof(decimal), "0.01", "999999999")]
    public decimal Amount { get; set; }

    [Required]
    [StringLength(30)]
    public string PaymentMethod { get; set; } = "";

    [StringLength(100)]
    public string? ReferenceNumber { get; set; }
}