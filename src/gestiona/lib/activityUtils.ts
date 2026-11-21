import { getPuedeEscribir } from "./nube";
import { Activity, Member, WorkspaceType } from "../types";

/**
 * Checks whether a member is one of the equipment specialists:
 * Pedro ("Pedro de la I."), Olga ("Olga Parra"), and Mauricio ("Mauricio Garcia").
 */
export function isSpecialistMember(member?: Member | null): boolean {
  if (!member) return false;
  const name = (member.name || "").trim().toLowerCase();
  const role = (member.role || "").trim().toLowerCase();
  const email = (member.email || "").trim().toLowerCase();
  return (
    name.includes("pedro") ||
    name.includes("olga") ||
    name.includes("mauricio") ||
    email.includes("piglesia") ||
    email.includes("oparra") ||
    email.includes("mauricioroberto") ||
    (role.includes("especialista") && (role.includes("eica") || role.includes("i&c") || role.includes("mecanic") || role.includes("mecánic")))
  );
}

/**
 * Checks whether a member is Tomas Suarez or Carlos Torres.
 */
export function isTomasOrCarlosMember(member?: Member | null): boolean {
  if (!member) return false;
  const name = (member.name || "").trim().toLowerCase();
  return (
    name === "tomas suarez" ||
    name === "tomás suárez" ||
    name.includes("tomas suarez") ||
    name.includes("tomás suárez") ||
    name === "carlos torres" ||
    name.includes("carlos torres")
  );
}

/**
 * Filters members according to workspace rule:
 * - Equipos: All members EXCEPT Tomas Suarez and Carlos Torres. Specialists Pedro, Olga and Mauricio belong here.
 * - Construccion: Tomas Suarez and Carlos Torres, PLUS equipment specialists Pedro, Olga and Mauricio (toggle Construcción activo), plus any member assigned to construccion.
 */
export function filterMembersByWorkspace(members: Member[] = [], workspace: WorkspaceType = "equipos"): Member[] {
  if (workspace === "equipos") {
    return members.filter((m) => {
      // Must NEVER include Tomas Suarez or Carlos Torres in Equipos
      if (isTomasOrCarlosMember(m)) return false;

      // Specialists Pedro, Olga and Mauricio ALWAYS belong to Equipos
      if (isSpecialistMember(m)) return true;

      // Must be assigned to equipos (or default legacy member)
      if (m.workspaces && m.workspaces.length > 0) {
        return m.workspaces.includes("equipos");
      }
      if (m.workspace) {
        return m.workspace === "equipos";
      }
      return true; // legacy/default members belong to equipos
    });
  }

  // construccion workspace
  return members.filter((m) => {
    // Tomas Suarez and Carlos Torres ALWAYS belong to Construcción
    if (isTomasOrCarlosMember(m)) return true;

    // Equipment specialists Pedro, Olga and Mauricio ALWAYS belong to Construcción as well
    if (isSpecialistMember(m)) return true;

    // Any other member created for / assigned to construccion
    if (m.workspaces && m.workspaces.includes("construccion")) {
      return true;
    }
    if (m.workspace === "construccion") {
      return true;
    }

    // Legacy initial equipos director MEM-01 does NOT belong to Construccion unless explicitly assigned
    if (["MEM-01", "MEM-02", "MEM-03", "MEM-04", "MEM-05"].includes(m.id)) {
      return false;
    }

    return false;
  });
}

/**
 * Generates the next sequential, guaranteed-unique Activity ID (e.g. "ACT-015" or "CST-008").
 * Scans all existing activity IDs for the given prefix, identifies the highest numerical suffix,
 * and increments safely without any possibility of collision or overwriting.
 */
export function generateNextActivityId(activities: Activity[] = [], prefix: string = "ACT"): string {
  const cleanPrefix = prefix.toUpperCase().trim();
  let maxNum = 0;

  for (const act of activities) {
    if (!act || !act.id) continue;
    const cleanId = act.id.trim().toUpperCase();
    if (cleanId.startsWith(`${cleanPrefix}-`)) {
      const rest = cleanId.slice(cleanPrefix.length + 1);
      const match = rest.match(/^\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        // Avoid gigantic numbers (e.g. timestamps) so sequence stays clean
        if (!isNaN(num) && num < 100000 && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  let nextNum = maxNum + 1;

  // Safeguard: verify that the proposed ID is not already used in any form
  const existingIds = new Set(
    activities
      .filter((a) => a && a.id)
      .map((a) => a.id.trim().toLowerCase())
  );

  while (existingIds.has(`${cleanPrefix.toLowerCase()}-${nextNum.toString().padStart(3, "0")}`)) {
    nextNum++;
  }

  return `${cleanPrefix}-${nextNum.toString().padStart(3, "0")}`;
}

/**
 * Checks if a given Activity ID is already in use by another activity.
 */
export function isActivityIdTaken(
  proposedId: string,
  activities: Activity[] = [],
  currentActivityId?: string
): boolean {
  if (!proposedId) return false;
  const cleanProposed = proposedId.trim().toLowerCase();
  const cleanCurrent = (currentActivityId || "").trim().toLowerCase();

  return activities.some((act) => {
    if (!act || !act.id) return false;
    const actId = act.id.trim().toLowerCase();
    if (cleanCurrent && actId === cleanCurrent) return false;
    return actId === cleanProposed;
  });
}

/**
 * Checks whether a member specifically corresponds to Director Alejandro Tejeda.
 */
export function isAlejandroTejeda(member?: Member | null): boolean {
  if (!member) return false;
  const id = (member.id || "").trim().toLowerCase();
  const name = (member.name || "").trim().toLowerCase();
  const email = (member.email || "").trim().toLowerCase();

  return (
    id === "mem-01" ||
    name === "alejandro tejeda" ||
    name === "alejandro torres" ||
    name.includes("alejandro tejeda") ||
    name.includes("alejandro torres") ||
    name.includes("alejandro") ||
    email === "atejada@acciona.com" ||
    email === "alejandrotm91@gmail.com"
  );
}

/**
 * Checks if a member has editing/creation permissions.
 * Exclusively granted to Alejandro Tejeda as requested.
 */
/** En Trakciona solo edita quien inició sesión como admin (el miembro elegido no cambia el permiso). */
export function canUserEdit(_member?: Member | null): boolean {
  return getPuedeEscribir();
}


