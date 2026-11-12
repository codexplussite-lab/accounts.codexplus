import { vi } from "vitest";

export function createInMemoryPrisma() {
  const users: any[] = [];
  const companies: any[] = [];
  const memberships: any[] = [];
  const accounts: any[] = [];
  const warehouses: any[] = [];
  const sequences: any[] = [];
  const fiscalYears: any[] = [];
  const journalEntries: any[] = [];
  const journalLines: any[] = [];
  const auditLogs: any[] = [];

  const db = {
    user: {
      create: vi.fn(async ({ data }: any) => {
        const u = { id: `user-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...data };
        users.push(u);
        return u;
      }),
      findUnique: vi.fn(async ({ where, include, select }: any) => {
        const u = users.find((x) => (where.id && x.id === where.id) || (where.email && x.email === where.email));
        if (!u) return null;

        const userMemberships = memberships
          .filter((m) => m.userId === u.id)
          .map((m) => {
            const comp = companies.find((c) => c.id === m.companyId);
            return { ...m, company: comp };
          });

        const result = {
          ...u,
          memberships: userMemberships
        };

        if (select) {
          const selected: any = {};
          Object.keys(select).forEach((k) => {
            if (select[k]) {
              selected[k] = (result as any)[k];
            }
          });
          return selected;
        }

        return result;
      }),
      findMany: vi.fn(async () => users)
    },
    company: {
      create: vi.fn(async ({ data }: any) => {
        const c = { id: `comp-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...data };
        companies.push(c);
        return c;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return companies.find((x) => x.id === where.id) || null;
      }),
      findMany: vi.fn(async () => companies),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = companies.findIndex((x) => x.id === where.id);
        if (idx >= 0) {
          companies[idx] = { ...companies[idx], ...data };
          return companies[idx];
        }
        return null;
      })
    },
    membership: {
      create: vi.fn(async ({ data }: any) => {
        const m = { ...data };
        memberships.push(m);
        return m;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const { userId, companyId } = where.userId_companyId || {};
        const found = memberships.find((m) => m.userId === userId && m.companyId === companyId);
        if (!found) return null;
        const comp = companies.find((c) => c.id === found.companyId);
        return { ...found, company: comp };
      }),
      findMany: vi.fn(async ({ where, include }: any) => {
        return memberships
          .filter((m) => !where?.userId || m.userId === where.userId)
          .map((m) => {
            if (include?.company) {
              const comp = companies.find((c) => c.id === m.companyId);
              return { ...m, company: comp };
            }
            return m;
          });
      })
    },
    account: {
      create: vi.fn(async ({ data }: any) => {
        const a = { id: `acc-${Date.now()}-${Math.random()}`, ...data };
        accounts.push(a);
        return a;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.companyId_code) {
          return (
            accounts.find(
              (x) => x.companyId === where.companyId_code.companyId && x.code === where.companyId_code.code
            ) || null
          );
        }
        return accounts.find((x) => x.id === where.id) || null;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          accounts.find(
            (x) => (!where.id || x.id === where.id) && (!where.companyId || x.companyId === where.companyId)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return accounts.filter((x) => {
          if (where?.companyId && x.companyId !== where.companyId) return false;
          if (where?.id?.in && !where.id.in.includes(x.id)) return false;
          if (where?.type && x.type !== where.type) return false;
          if (where?.isActive !== undefined && x.isActive !== where.isActive) return false;
          return true;
        });
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = accounts.findIndex((x) => x.id === where.id);
        if (idx >= 0) {
          accounts[idx] = { ...accounts[idx], ...data };
          return accounts[idx];
        }
        return null;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = accounts.findIndex((x) => x.id === where.id);
        if (idx >= 0) {
          const deleted = accounts.splice(idx, 1)[0];
          return deleted;
        }
        return null;
      }),
      count: vi.fn(async ({ where }: any) => {
        return accounts.filter((x) => {
          if (where.companyId && x.companyId !== where.companyId) return false;
          if (where.parentId && x.parentId !== where.parentId) return false;
          return true;
        }).length;
      })
    },
    warehouse: {
      create: vi.fn(async ({ data }: any) => {
        const w = { id: `wh-${Date.now()}-${Math.random()}`, ...data };
        warehouses.push(w);
        return w;
      }),
      findMany: vi.fn(async ({ where }: any) => warehouses.filter((w) => w.companyId === where?.companyId))
    },
    documentSequence: {
      create: vi.fn(async ({ data }: any) => {
        const s = { ...data };
        sequences.push(s);
        return s;
      }),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const { companyId, type, year } = where.companyId_type_year;
        let seq = sequences.find((s) => s.companyId === companyId && s.type === type && s.year === year);
        if (seq) {
          if (update?.last?.increment) {
            seq.last += update.last.increment;
          }
          return seq;
        }
        seq = { companyId, type, year, last: create.last || 1 };
        sequences.push(seq);
        return seq;
      })
    },
    fiscalYear: {
      create: vi.fn(async ({ data }: any) => {
        const fy = { id: `fy-${Date.now()}`, ...data };
        fiscalYears.push(fy);
        return fy;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          fiscalYears.find((fy) => {
            if (where.companyId && fy.companyId !== where.companyId) return false;
            if (where.isClosed !== undefined && fy.isClosed !== where.isClosed) return false;
            if (where.startDate?.lte && fy.startDate > where.startDate.lte) return false;
            if (where.endDate?.gte && fy.endDate < where.endDate.gte) return false;
            return true;
          }) || null
        );
      })
    },
    journalEntry: {
      create: vi.fn(async ({ data }: any) => {
        const id = `je-${Date.now()}-${Math.random()}`;
        const entry = {
          id,
          createdAt: new Date(),
          ...data,
          lines: []
        };
        if (data.lines?.create) {
          entry.lines = data.lines.create.map((l: any) => ({
            id: `line-${Date.now()}-${Math.random()}`,
            entryId: id,
            ...l,
            account: accounts.find((a) => a.id === l.accountId) || { id: l.accountId, code: "ACC", name: "Mock Account" }
          }));
          journalLines.push(...entry.lines);
        }
        journalEntries.push(entry);
        return entry;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const entry = journalEntries.find((e) => {
          if (where.id && e.id !== where.id) return false;
          if (where.companyId && e.companyId !== where.companyId) return false;
          return true;
        });
        if (!entry) return null;
        const lines = journalLines.filter((l) => l.entryId === entry.id).map((l) => ({
          ...l,
          account: accounts.find((a) => a.id === l.accountId) || { id: l.accountId, code: "ACC", name: "Mock Account" }
        }));
        return { ...entry, lines };
      }),
      findMany: vi.fn(async ({ where, skip = 0, take = 20 }: any) => {
        const filtered = journalEntries.filter((e) => {
          if (where?.companyId && e.companyId !== where.companyId) return false;
          if (where?.status && e.status !== where.status) return false;
          return true;
        });
        return filtered.slice(skip, skip + take).map((entry) => ({
          ...entry,
          lines: journalLines.filter((l) => l.entryId === entry.id)
        }));
      }),
      count: vi.fn(async ({ where }: any) => {
        return journalEntries.filter((e) => {
          if (where?.companyId && e.companyId !== where.companyId) return false;
          if (where?.status && e.status !== where.status) return false;
          return true;
        }).length;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = journalEntries.findIndex((e) => e.id === where.id);
        if (idx >= 0) {
          journalEntries[idx] = { ...journalEntries[idx], ...data };
          return journalEntries[idx];
        }
        return null;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = journalEntries.findIndex((e) => e.id === where.id);
        if (idx >= 0) {
          return journalEntries.splice(idx, 1)[0];
        }
        return null;
      })
    },
    journalLine: {
      deleteMany: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (let i = journalLines.length - 1; i >= 0; i--) {
          if (journalLines[i].entryId === where.entryId) {
            journalLines.splice(i, 1);
            count++;
          }
        }
        return { count };
      }),
      count: vi.fn(async ({ where }: any) => {
        return journalLines.filter((l) => {
          if (where.accountId && l.accountId !== where.accountId) return false;
          return true;
        }).length;
      })
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        const log = { id: `log-${Date.now()}`, timestamp: new Date(), ...data };
        auditLogs.push(log);
        return log;
      })
    },
    $transaction: vi.fn(async (callback: any) => {
      if (typeof callback === "function") {
        return callback(db);
      }
      return Promise.all(callback);
    })
  };

  return {
    db,
    stores: {
      users,
      companies,
      memberships,
      accounts,
      warehouses,
      sequences,
      fiscalYears,
      journalEntries,
      journalLines,
      auditLogs
    }
  };
}
