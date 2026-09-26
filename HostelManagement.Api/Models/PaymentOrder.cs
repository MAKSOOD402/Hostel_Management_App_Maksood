namespace HostelManagement.Api.Models;

public class PaymentOrder
{
    public long Id { get; set; }
    public long HostelId { get; set; }
    public long BillId { get; set; }
    public required string GatewayOrderId { get; set; }
    public string? GatewayPaymentId { get; set; }
    public decimal Amount { get; set; }
    public long AmountPaise { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = "Created";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
}