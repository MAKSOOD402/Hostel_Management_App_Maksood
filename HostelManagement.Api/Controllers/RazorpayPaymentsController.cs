using System.Security.Cryptography;
using System.Text;
using HostelManagement.Api.Data;
using HostelManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Microsoft.AspNetCore.Authorization;
namespace HostelManagement.Api.Controllers;
[Authorize(Roles = "Admin,Staff")]
[ApiController]
[Route("api/payments/razorpay")]
public class RazorpayPaymentsController : ControllerBase
{
    private readonly HostelDbContext _db;
    private readonly RazorpayOrderService _razorpay;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RazorpayPaymentsController> _logger;

    public RazorpayPaymentsController(
        HostelDbContext db,
        RazorpayOrderService razorpay,
        IConfiguration configuration,
        ILogger<RazorpayPaymentsController> logger)
    {
        _db = db;
        _razorpay = razorpay;
        _configuration = configuration;
        _logger = logger;
    }

    // POST: /api/payments/razorpay/confirm
    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm(
        ConfirmRazorpayPaymentRequest request,
        CancellationToken cancellationToken)
    {
        var order = await _db.PaymentOrders
            .FirstOrDefaultAsync(
                x => x.GatewayOrderId == request.RazorpayOrderId,
                cancellationToken);

        if (order is null)
            return NotFound(new { message = "Payment order not found." });

        // Make retries safe if Razorpay sends the same success callback again.
        if (order.Status == "Paid")
        {
            if (order.GatewayPaymentId == request.RazorpayPaymentId)
            {
                return Ok(new
                {
                    message = "Payment was already confirmed.",
                    order.BillId,
                    order.GatewayPaymentId
                });
            }

            return Conflict(new
            {
                message = "This order has already been paid with a different payment."
            });
        }

        var keySecret = _configuration["Razorpay:KeySecret"];

        if (string.IsNullOrWhiteSpace(keySecret))
        {
            _logger.LogError("Razorpay key secret is not configured.");
            return StatusCode(500, new { message = "Payment verification is unavailable." });
        }

        if (!IsValidSignature(
                request.RazorpayOrderId,
                request.RazorpayPaymentId,
                request.RazorpaySignature,
                keySecret))
        {
            _logger.LogWarning(
                "Invalid Razorpay signature for order {OrderId}",
                request.RazorpayOrderId);

            return BadRequest(new { message = "Invalid Razorpay signature." });
        }

        RazorpayPaymentDetails payment;

        try
        {
            payment = await _razorpay.FetchPayment(
                request.RazorpayPaymentId,
                cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(
                ex,
                "Could not fetch Razorpay payment {PaymentId}",
                request.RazorpayPaymentId);

            return StatusCode(
                StatusCodes.Status502BadGateway,
                new { message = "Could not verify payment with Razorpay." });
        }

        if (payment.OrderId != order.GatewayOrderId ||
            payment.Amount != order.AmountPaise ||
            payment.Currency != "INR")
        {
            return BadRequest(new
            {
                message = "Razorpay payment does not match the stored order."
            });
        }

        if (payment.Status != "captured")
        {
            return Conflict(new
            {
                message = $"Payment is not captured. Razorpay status: {payment.Status}."
            });
        }

        var paymentMethod = MapPaymentMethod(payment.Method);
        var receiptNumber = $"RCT-{Guid.NewGuid():N}";

        await using var transaction =
            await _db.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var recordedPaymentId = await _db.Database
                .SqlQuery<long>($"""
                    SELECT record_successful_payment(
                        {order.HostelId},
                        {order.BillId},
                        {order.Amount},
                        {paymentMethod},
                        {"Razorpay"},
                        {payment.Id},
                        {receiptNumber}
                    ) AS "Value"
                    """)
                .SingleAsync(cancellationToken);

            order.GatewayPaymentId = payment.Id;
            order.Status = "Paid";
            order.PaidAt = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation(
                "Confirmed Razorpay payment {PaymentId} for bill {BillId}",
                payment.Id,
                order.BillId);

            return Ok(new
            {
                message = "Payment confirmed.",
                paymentId = recordedPaymentId,
                order.BillId,
                order.GatewayPaymentId,
                order.Amount
            });
        }
        catch (PostgresException ex)
        {
            await transaction.RollbackAsync(cancellationToken);

            _logger.LogError(
                ex,
                "Database rejected Razorpay payment {PaymentId}",
                payment.Id);

            return Conflict(new { message = ex.MessageText });
        }
    }

    private static bool IsValidSignature(
        string orderId,
        string paymentId,
        string receivedSignature,
        string keySecret)
    {
        try
        {
            var key = Encoding.UTF8.GetBytes(keySecret);
            var message = Encoding.UTF8.GetBytes($"{orderId}|{paymentId}");
            var expectedSignature = HMACSHA256.HashData(key, message);
            var receivedBytes = Convert.FromHexString(receivedSignature);

            return CryptographicOperations.FixedTimeEquals(
                expectedSignature,
                receivedBytes);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static string MapPaymentMethod(string method) =>
        method.ToLowerInvariant() switch
        {
            "upi" => "UPI",
            "card" => "Card",
            "netbanking" => "NetBanking",
            "bank_transfer" => "BankTransfer",
            "wallet" => "Other",
            "emi" => "Card",
            _ => "Other"
        };
}

public sealed class ConfirmRazorpayPaymentRequest
{
    public string RazorpayOrderId { get; set; } = "";
    public string RazorpayPaymentId { get; set; } = "";
    public string RazorpaySignature { get; set; } = "";
}