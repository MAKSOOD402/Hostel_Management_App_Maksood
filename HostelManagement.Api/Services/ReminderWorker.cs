using System.Data.Common;
using HostelManagement.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace HostelManagement.Api.Services;

public sealed class ReminderWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReminderWorker> _logger;

    public ReminderWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<ReminderWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDueReminders(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Reminder worker failed to process a batch");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }

    private async Task ProcessDueReminders(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<HostelDbContext>();

        var reminders = await ClaimDueReminders(db, cancellationToken);

        foreach (var reminder in reminders)
        {
            await ProcessOneReminder(db, reminder, cancellationToken);
        }
    }

    private static async Task<List<DueReminder>> ClaimDueReminders(
        HostelDbContext db,
        CancellationToken cancellationToken)
    {
        await db.Database.OpenConnectionAsync(cancellationToken);

        try
        {
            var connection = db.Database.GetDbConnection();

            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT * FROM claim_due_reminders(@limit)";

            var limitParameter = command.CreateParameter();
            limitParameter.ParameterName = "limit";
            limitParameter.Value = 50;
            command.Parameters.Add(limitParameter);

            var reminders = new List<DueReminder>();

            await using var reader =
                await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                reminders.Add(new DueReminder(
                    reader.GetInt64(reader.GetOrdinal("reminder_id")),
                    reader.GetInt64(reader.GetOrdinal("bill_id")),
                    reader.GetInt64(reader.GetOrdinal("tenant_id")),
                    reader.GetInt64(reader.GetOrdinal("hostel_id")),
                    reader.GetString(reader.GetOrdinal("channel")),
                    reader.GetString(reader.GetOrdinal("bill_number"))));
            }

            return reminders;
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private async Task ProcessOneReminder(
        HostelDbContext db,
        DueReminder reminder,
        CancellationToken cancellationToken)
    {
        await using var transaction =
            await db.Database.BeginTransactionAsync(cancellationToken);

        // Locking the bill serializes this check against the payment function,
        // which also locks the bill before marking it Paid.
        var connection = db.Database.GetDbConnection();

        await using var checkCommand = connection.CreateCommand();
        checkCommand.Transaction =
            db.Database.CurrentTransaction!.GetDbTransaction();
        checkCommand.CommandText =
            "SELECT status FROM bills WHERE id = @billId FOR UPDATE";

        AddParameter(checkCommand, "billId", reminder.BillId);

        var statusValue =
            await checkCommand.ExecuteScalarAsync(cancellationToken);

        var billStatus = statusValue as string;

        var schedule = await db.ReminderSchedules
            .FirstOrDefaultAsync(
                x => x.Id == reminder.ReminderId,
                cancellationToken);

        if (schedule is null)
        {
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        if (billStatus is not ("Pending" or "Overdue"))
        {
            schedule.Status = "Cancelled";
            schedule.ProcessedAt = DateTimeOffset.UtcNow;

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation(
                "Skipped reminder {ReminderId}; bill {BillId} is {BillStatus}",
                reminder.ReminderId,
                reminder.BillId,
                billStatus ?? "missing");

            return;
        }

        await using var insertCommand = connection.CreateCommand();
        insertCommand.Transaction =
            db.Database.CurrentTransaction!.GetDbTransaction();
        insertCommand.CommandText = """
            INSERT INTO notifications
                (hostel_id, tenant_id, bill_id, channel, title, message)
            VALUES
                (@hostelId, @tenantId, @billId, 'InApp', @title, @message)
            """;

        AddParameter(insertCommand, "hostelId", reminder.HostelId);
        AddParameter(insertCommand, "tenantId", reminder.TenantId);
        AddParameter(insertCommand, "billId", reminder.BillId);
        AddParameter(insertCommand, "title", "Bill payment reminder");
        AddParameter(
            insertCommand,
            "message",
            $"Bill {reminder.BillNumber} is overdue. Please review your bill.");

        await insertCommand.ExecuteNonQueryAsync(cancellationToken);

        schedule.Status = "Sent";
        schedule.ProcessedAt = DateTimeOffset.UtcNow;
        schedule.LastError = null;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation(
            "Created in-app reminder {ReminderId} for bill {BillId}",
            reminder.ReminderId,
            reminder.BillId);
    }

    private static void AddParameter(
        DbCommand command,
        string name,
        object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private sealed record DueReminder(
        long ReminderId,
        long BillId,
        long TenantId,
        long HostelId,
        string Channel,
        string BillNumber);
}