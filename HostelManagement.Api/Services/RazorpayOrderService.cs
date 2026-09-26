using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;

namespace HostelManagement.Api.Services;
using System.Text.Json.Serialization;
public sealed class RazorpayOrderService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public RazorpayOrderService(
        HttpClient httpClient,
        IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<RazorpayPaymentDetails> FetchPayment(
    string paymentId,
    CancellationToken cancellationToken)
    {
        var keyId = _configuration["Razorpay:KeyId"];
        var keySecret = _configuration["Razorpay:KeySecret"];

        if (string.IsNullOrWhiteSpace(keyId) ||
            string.IsNullOrWhiteSpace(keySecret))
        {
            throw new InvalidOperationException(
                "Razorpay keys are missing from user secrets.");
        }

        var credentials = Convert.ToBase64String(
            Encoding.UTF8.GetBytes($"{keyId}:{keySecret}"));

        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"payments/{Uri.EscapeDataString(paymentId)}");

        request.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Basic",
                credentials);

        using var response = await _httpClient.SendAsync(
            request,
            cancellationToken);

        response.EnsureSuccessStatusCode();

        var payment = await response.Content
            .ReadFromJsonAsync<RazorpayPaymentDetails>(
                cancellationToken: cancellationToken);

        return payment ?? throw new InvalidOperationException(
            "Razorpay returned an empty payment response.");
    }
    public async Task<RazorpayCreatedOrder> CreateOrder(
        long amountPaise,
        string receipt,
        CancellationToken cancellationToken)
    {
        var keyId = _configuration["Razorpay:KeyId"];
        var keySecret = _configuration["Razorpay:KeySecret"];

        if (string.IsNullOrWhiteSpace(keyId) ||
            string.IsNullOrWhiteSpace(keySecret))
        {
            throw new InvalidOperationException(
                "Razorpay test keys are missing from user secrets.");
        }

        var credentials = Convert.ToBase64String(
            Encoding.UTF8.GetBytes($"{keyId}:{keySecret}"));

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            "orders");

        request.Headers.Authorization =
            new AuthenticationHeaderValue("Basic", credentials);

        request.Content = JsonContent.Create(new
        {
            amount = amountPaise,
            currency = "INR",
            receipt
        });

        using var response = await _httpClient.SendAsync(
            request,
            cancellationToken);

        response.EnsureSuccessStatusCode();

        var result = await response.Content
            .ReadFromJsonAsync<RazorpayCreatedOrder>(
                cancellationToken: cancellationToken);

        return result ?? throw new InvalidOperationException(
            "Razorpay returned an empty order response.");
    }
}

public sealed class RazorpayCreatedOrder
{
    public string Id { get; set; } = "";
    public long Amount { get; set; }
    public string Currency { get; set; } = "";
    public string Status { get; set; } = "";
}
public sealed class RazorpayPaymentDetails
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("order_id")]
    public string OrderId { get; set; } = "";

    [JsonPropertyName("amount")]
    public long Amount { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "";

    [JsonPropertyName("status")]
    public string Status { get; set; } = "";

    [JsonPropertyName("method")]
    public string Method { get; set; } = "";
}