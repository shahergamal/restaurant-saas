import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { elapsedMinutes } from '@sufra/shared';
import { AuditService } from '../../common/audit.service';
import { EventsService } from '../../common/events.service';
import { DbService } from '../../common/prisma.service';
import { ctx, currentBranchId } from '../../common/tenant-context';
import { startOfRiyadhDay } from '../../common/time';

@Injectable()
export class KitchenService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly events: EventsService,
  ) {}

  async board() {
    const branchId = currentBranchId();
    const now = new Date();
    const since = startOfRiyadhDay(now);
    const [org, stations, tickets, completed] = await Promise.all([
      this.db.client.organization.findFirstOrThrow({ select: { delayThresholdMin: true } }),
      this.db.client.station.findMany({ where: { branchId }, orderBy: { sort: 'asc' } }),
      this.db.client.kitchenTicket.findMany({
        where: { station: { branchId }, status: 'cooking' },
        orderBy: { createdAt: 'asc' },
        include: {
          order: {
            select: {
              id: true, number: true, guests: true, channel: true, notes: true,
              table: { select: { label: true } },
              items: { include: { menuItem: { select: { nameAr: true, nameEn: true, image: true } } } },
            },
          },
        },
      }),
      this.db.client.kitchenTicket.groupBy({
        by: ['stationId'],
        where: { station: { branchId }, status: { in: ['ready', 'served'] }, readyAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    return {
      thresholdMin: org.delayThresholdMin,
      stations: stations.map((s) => ({
        id: s.id,
        key: s.key,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        completedToday: completed.find((c) => c.stationId === s.id)?._count._all ?? 0,
        tickets: tickets
          .filter((t) => t.stationId === s.id)
          .map((t) => ({
            id: t.id,
            orderId: t.order.id,
            orderNumber: t.order.number,
            table: t.order.table?.label ?? null,
            channel: t.order.channel,
            elapsedMin: elapsedMinutes(t.createdAt, now),
            estimatedMin: t.estimatedMin,
            items: t.order.items
              .filter((i) => i.stationId === s.id)
              .map((i) => ({ id: i.id, nameAr: i.menuItem.nameAr, nameEn: i.menuItem.nameEn, image: i.menuItem.image, qty: i.qty, modifiers: i.modifiers, status: i.status })),
          })),
      })),
    };
  }

  async ticket(id: string) {
    const t = await this.db.client.kitchenTicket.findFirst({
      where: { id, station: { branchId: currentBranchId() } },
      include: {
        station: true,
        order: {
          include: {
            table: { select: { label: true } },
            items: { include: { menuItem: { select: { nameAr: true, nameEn: true, image: true } } } },
          },
        },
      },
    });
    if (!t) throw new NotFoundException('ticket_not_found');
    const now = new Date();
    const items = t.order.items.filter((i) => i.stationId === t.stationId);
    return {
      id: t.id,
      status: t.status,
      orderId: t.order.id,
      orderNumber: t.order.number,
      orderStatus: t.order.status,
      table: t.order.table?.label ?? null,
      guests: t.order.guests,
      createdAt: t.createdAt,
      elapsedMin: elapsedMinutes(t.createdAt, now),
      estimatedMin: t.estimatedMin,
      station: { key: t.station.key, nameAr: t.station.nameAr, nameEn: t.station.nameEn },
      notes: [t.order.notes, ...items.map((i) => i.notes)].filter(Boolean),
      items: items.map((i) => ({ id: i.id, nameAr: i.menuItem.nameAr, nameEn: i.menuItem.nameEn, image: i.menuItem.image, qty: i.qty, modifiers: i.modifiers })),
      totalItems: items.reduce((s, i) => s + i.qty, 0),
    };
  }

  async markReady(id: string) {
    const c = ctx();
    const branchId = currentBranchId();
    await this.db.tx(async (tx) => {
      const t = await tx.kitchenTicket.findFirst({ where: { id, station: { branchId } }, include: { order: true } });
      if (!t) throw new NotFoundException('ticket_not_found');
      if (t.status !== 'cooking') throw new BadRequestException('ticket_not_cooking');
      const now = new Date();
      await tx.kitchenTicket.update({ where: { id }, data: { status: 'ready', readyAt: now } });
      await tx.orderItem.updateMany({ where: { orderId: t.orderId, stationId: t.stationId }, data: { status: 'ready', readyAt: now } });
      const stillCooking = await tx.kitchenTicket.count({ where: { orderId: t.orderId, status: 'cooking' } });
      if (stillCooking === 0 && t.order.status === 'in_progress') {
        await tx.order.update({ where: { id: t.orderId }, data: { status: 'ready', readyAt: now } });
        const station = await tx.station.findUniqueOrThrow({ where: { id: t.stationId } });
        await tx.activityEvent.create({
          data: { organizationId: c.orgId!, branchId, kind: 'order_ready', data: { number: t.order.number, stationEn: station.nameEn, stationAr: station.nameAr } },
        });
      }
      await this.audit.log('kitchen.ready', 'kitchen_ticket', id, null, tx);
    });
    this.events.emitToBranch(c.orgId!, branchId, 'ticket.updated', { id });
    return { ok: true };
  }

  /** Today's kitchen KPIs vs the previous hour. */
  async performance() {
    const branchId = currentBranchId();
    const org = await this.db.client.organization.findFirstOrThrow({ select: { delayThresholdMin: true } });
    const now = new Date();
    const since = startOfRiyadhDay(now);
    const hourAgo = new Date(now.getTime() - 3_600_000);
    const twoHoursAgo = new Date(now.getTime() - 7_200_000);
    const done = await this.db.client.kitchenTicket.findMany({
      where: { station: { branchId }, readyAt: { gte: since } },
      select: { createdAt: true, readyAt: true },
    });
    const prep = (from: Date, to: Date) => {
      const set = done.filter((d) => d.readyAt! >= from && d.readyAt! < to);
      return set.length ? set.reduce((s, d) => s + (d.readyAt!.getTime() - d.createdAt.getTime()), 0) / set.length / 60_000 : 0;
    };
    const durations = done.map((d) => (d.readyAt!.getTime() - d.createdAt.getTime()) / 60_000);
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const onTime = durations.length ? durations.filter((d) => d <= org.delayThresholdMin).length / durations.length : 1;
    const delayed = await this.db.client.kitchenTicket.count({
      where: { station: { branchId }, status: 'cooking', createdAt: { lt: new Date(now.getTime() - org.delayThresholdMin * 60_000) } },
    });
    const lastHourCount = done.filter((d) => d.readyAt! >= hourAgo).length;
    const prevHourCount = done.filter((d) => d.readyAt! >= twoHoursAgo && d.readyAt! < hourAgo).length;
    return {
      avgPrepMin: Math.round(avg),
      onTimePct: Math.round(onTime * 100),
      delayed,
      throughputDeltaPct: prevHourCount ? Math.round(((lastHourCount - prevHourCount) / prevHourCount) * 100) : 0,
      lastHourPrepMin: Math.round(prep(hourAgo, now)),
    };
  }
}
