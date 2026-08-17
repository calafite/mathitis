import type { LineageNode, LineageResponse } from '@mathitis/schemas';
import type { MentorshipRepository } from '../repositories/mentorship-repository.js';

export interface LineageService {
  getFullGraph(): Promise<LineageResponse>;
  getSubgraph(handle: string): Promise<LineageResponse>;
}

/**
 * Builds an undirected ego-graph by expanding mentorships reachable from the
 * requested handle, preserving academic-year edges for the timeline grouping.
 */
export function createLineageService(mentorshipRepository: MentorshipRepository): LineageService {
  async function getFullGraph() {
    const rows = await mentorshipRepository.listLineage();

    const nodeMap = new Map<string, LineageNode>();
    const edges: LineageResponse['edges'] = [];
    const academicYears = new Set<string>();

    for (const row of rows) {
      academicYears.add(row.academicYear);
      addNode(nodeMap, row.mentorId, row.mentor.handle, row.mentor.socialName, row.mentor.semester, row.mentor.role);
      addNode(nodeMap, row.menteeId, row.mentee.handle, row.mentee.socialName, row.mentee.semester, row.mentee.role);
      edges.push({
        mentorId: row.mentorId,
        menteeId: row.menteeId,
        academicYear: row.academicYear,
        semester: row.semester,
      });
    }

    return {
      nodes: [...nodeMap.values()],
      edges,
      academicYears: [...academicYears].sort(),
    };
  }

  async function getSubgraph(handle: string) {
    const rows = await mentorshipRepository.listLineage();
    const relevant = rows.filter(
      (row) => row.mentor.handle === handle || row.mentee.handle === handle,
    );

    const nodeMap = new Map<string, LineageNode>();
    const edges: LineageResponse['edges'] = [];
    const academicYears = new Set<string>();

    for (const row of relevant) {
      academicYears.add(row.academicYear);
      addNode(nodeMap, row.mentorId, row.mentor.handle, row.mentor.socialName, row.mentor.semester, row.mentor.role);
      addNode(nodeMap, row.menteeId, row.mentee.handle, row.mentee.socialName, row.mentee.semester, row.mentee.role);
      edges.push({
        mentorId: row.mentorId,
        menteeId: row.menteeId,
        academicYear: row.academicYear,
        semester: row.semester,
      });
    }

    return {
      nodes: [...nodeMap.values()],
      edges,
      academicYears: [...academicYears].sort(),
    };
  }

  return { getFullGraph, getSubgraph };
}

function addNode(
  nodeMap: Map<string, LineageNode>,
  id: string,
  handle: string,
  socialName: string | null,
  semester: number,
  role: string,
) {
  if (nodeMap.has(id)) return;
  nodeMap.set(id, {
    id,
    handle,
    socialName,
    semester,
    role: role as LineageNode['role'],
  });
}