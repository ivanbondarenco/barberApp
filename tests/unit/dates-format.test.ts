import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  dateTime,
  dayShort,
  hoursUntil,
  isoWeekNumber,
  isSunday,
  longDate,
  minutesToTime,
  openDaysFrom,
  timeToMinutes,
  todayISO,
  toISODate,
  workWeek,
} from "@/lib/dates";
import { initials, money, onlyDigits, phoneKey, whatsappLink } from "@/lib/format";
import { freezeTime, MONDAY_9AM } from "./support/fixtures";

afterEach(() => vi.useRealTimers());

describe("fechas", () => {
  it("suma días cruzando meses y años", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("detecta domingos y arma días hábiles salteándolos", () => {
    expect(isSunday("2026-09-20")).toBe(true);
    expect(openDaysFrom("2026-09-18", 3)).toEqual(["2026-09-18", "2026-09-19", "2026-09-21"]);
  });

  it("la semana laboral va de lunes a sábado aunque hoy sea domingo", () => {
    expect(workWeek("2026-09-16")).toEqual(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"]);
    expect(workWeek("2026-09-20")[0]).toBe("2026-09-14");
    expect(workWeek("2026-09-16", 1)[0]).toBe("2026-09-21");
  });

  it("número de semana ISO", () => {
    expect(isoWeekNumber("2026-09-14")).toBe(38);
    expect(isoWeekNumber("2026-01-01")).toBe(1);
  });

  it("convierte horas y minutos", () => {
    expect(timeToMinutes("13:30")).toBe(810);
    expect(minutesToTime(810)).toBe("13:30");
    expect(minutesToTime(timeToMinutes("09:05"))).toBe("09:05");
  });

  it("calcula horas hasta un turno", () => {
    expect(hoursUntil("2026-09-14", "12:00", MONDAY_9AM)).toBe(3);
    expect(hoursUntil("2026-09-14", "08:00", MONDAY_9AM)).toBe(-1);
  });

  it("todayISO usa la fecha local", () => {
    freezeTime();
    expect(todayISO()).toBe("2026-09-14");
    expect(toISODate(dateTime("2026-09-14", "23:59"))).toBe("2026-09-14");
  });

  it("textos en español", () => {
    expect(dayShort("2026-09-16")).toBe("Mié");
    expect(longDate("2026-09-16")).toBe("Miércoles 16 Septiembre");
  });
});

describe("formato", () => {
  it("formatea pesos argentinos", () => {
    expect(money(11000)).toBe("$11.000");
    expect(money(0)).toBe("$0");
  });

  it("normaliza celulares a los últimos 10 dígitos", () => {
    expect(phoneKey("+54 9 11 5555-0192")).toBe("1155550192");
    expect(phoneKey("11 5555 0192")).toBe("1155550192");
    expect(onlyDigits("(011) 4-555")).toBe("0114555");
  });

  it("iniciales y link de WhatsApp", () => {
    expect(initials("Nico “Blade” R.")).toBe("NB");
    expect(initials("tomás ferreyra")).toBe("TF");
    expect(whatsappLink("+54 9 11 5555-0192", "Hola")).toBe("https://wa.me/5491155550192?text=Hola");
  });
});
