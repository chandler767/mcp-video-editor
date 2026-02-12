import {
  MultiTakeProject,
  TakeAnalysis,
  BestTakeSelection,
  TakeCandidate,
  AssemblyPlan,
  AssemblyQualityReport,
  ScriptSection,
  TimeSegment,
  MultiTakeError,
  ErrorCode
} from './multi-take-types.js';

/**
 * Select the best takes for each script section
 */
export class BestTakeSelector {

  /**
   * Select best takes for all script sections
   */
  selectBestTakes(project: MultiTakeProject): BestTakeSelection[] {
    const selections: BestTakeSelection[] = [];

    for (const section of project.script.sections) {
      const selection = this.selectBestTakeForSection(
        section,
        project.takes,
        project.settings.qualityThresholds
      );
      selections.push(selection);
    }

    return selections;
  }

  /**
   * Select best take for a single script section
   */
  private selectBestTakeForSection(
    section: ScriptSection,
    takes: TakeAnalysis[],
    thresholds: any
  ): BestTakeSelection {
    // Find all takes that cover this section
    const candidates = this.findCandidates(section, takes);

    if (candidates.length === 0) {
      return {
        sectionId: section.id,
        takeId: null,
        filePath: null,
        segment: null,
        score: 0,
        reason: 'No takes cover this section'
      };
    }

    // Rank candidates
    const ranked = this.rankCandidates(candidates);

    // Select best candidate
    const best = ranked[0];

    return {
      sectionId: section.id,
      takeId: best.takeId,
      filePath: best.filePath,
      segment: best.segment,
      score: best.overallScore,
      reason: this.generateSelectionReason(best, ranked.length)
    };
  }

  /**
   * Find candidate takes for a section
   */
  private findCandidates(
    section: ScriptSection,
    takes: TakeAnalysis[]
  ): TakeCandidate[] {
    const candidates: TakeCandidate[] = [];

    for (const take of takes) {
      // Skip failed analyses
      if (take.status !== 'analyzed') {
        continue;
      }

      // Find matching script section
      const match = take.scriptMatches.find(m => m.sectionId === section.id);

      if (!match || match.coverage < 0.5) {
        continue; // Section not sufficiently covered in this take
      }

      // Get time segment for this section
      const segment = this.extractTimeSegment(take, section.id);

      if (!segment) {
        continue;
      }

      candidates.push({
        takeId: take.takeId,
        filePath: take.filePath,
        segment,
        matchQuality: match.quality,
        overallScore: take.overallScore,
        audioQuality: take.audioQuality,
        videoQuality: take.videoQuality,
        issues: take.issues.filter(issue =>
          this.isIssueRelevantToSection(issue, segment)
        )
      });
    }

    return candidates;
  }

  /**
   * Extract time segment for a script section from a take
   */
  private extractTimeSegment(
    take: TakeAnalysis,
    sectionId: string
  ): TimeSegment | null {
    const ranges = take.coverage.timeRanges.get(sectionId);

    if (!ranges || ranges.length === 0) {
      return null;
    }

    // If multiple ranges, merge them or take the longest
    if (ranges.length === 1) {
      return ranges[0];
    }

    // Find longest continuous range
    let longest = ranges[0];
    for (const range of ranges) {
      if ((range.end - range.start) > (longest.end - longest.start)) {
        longest = range;
      }
    }

    return longest;
  }

  /**
   * Check if an issue is relevant to a specific time segment
   */
  private isIssueRelevantToSection(issue: any, segment: TimeSegment): boolean {
    if (!issue.location) {
      return true; // Global issues apply to all sections
    }

    // Check if issue's location overlaps with segment
    return (
      issue.location.start < segment.end &&
      issue.location.end > segment.start
    );
  }

  /**
   * Rank candidates by composite score
   */
  private rankCandidates(candidates: TakeCandidate[]): TakeCandidate[] {
    // Calculate composite score for each candidate
    const scored = candidates.map(candidate => {
      let score = candidate.overallScore;

      // Apply penalties for issues
      const errorCount = candidate.issues.filter(i => i.severity === 'error').length;
      const warningCount = candidate.issues.filter(i => i.severity === 'warning').length;

      score -= errorCount * 15; // -15 points per error
      score -= warningCount * 5; // -5 points per warning

      // Boost for high match quality
      if (candidate.matchQuality > 90) {
        score += 5;
      }

      return {
        ...candidate,
        compositeScore: Math.max(0, score)
      };
    });

    // Sort by composite score (descending)
    scored.sort((a, b) => b.compositeScore - a.compositeScore);

    return scored;
  }

  /**
   * Generate human-readable selection reason
   */
  private generateSelectionReason(best: TakeCandidate, totalCandidates: number): string {
    const parts: string[] = [];

    parts.push(`Best of ${totalCandidates} candidate(s)`);
    parts.push(`score: ${Math.round(best.overallScore)}`);

    if (best.matchQuality > 90) {
      parts.push('excellent script match');
    } else if (best.matchQuality > 75) {
      parts.push('good script match');
    }

    const errorCount = best.issues.filter(i => i.severity === 'error').length;
    const warningCount = best.issues.filter(i => i.severity === 'warning').length;

    if (errorCount === 0 && warningCount === 0) {
      parts.push('no issues');
    } else if (errorCount > 0) {
      parts.push(`${errorCount} error(s)`);
    } else if (warningCount > 0) {
      parts.push(`${warningCount} warning(s)`);
    }

    return parts.join(', ');
  }

  /**
   * Create assembly plan from best take selections
   */
  createAssemblyPlan(
    project: MultiTakeProject,
    selections: BestTakeSelection[]
  ): AssemblyPlan {
    let totalDuration = 0;
    const sectionsWithIssues: string[] = [];
    const recommendations: string[] = [];

    // Calculate total duration and identify issues
    for (const selection of selections) {
      if (selection.segment) {
        totalDuration += selection.segment.end - selection.segment.start;
      }

      if (!selection.takeId) {
        sectionsWithIssues.push(selection.sectionId);
        recommendations.push(
          `Section "${this.getSectionText(project, selection.sectionId)}" has no coverage - record additional takes`
        );
      } else if (selection.score < project.settings.qualityThresholds.minOverallScore) {
        sectionsWithIssues.push(selection.sectionId);
        recommendations.push(
          `Section "${this.getSectionText(project, selection.sectionId)}" has low quality (${Math.round(selection.score)}) - consider retake`
        );
      }
    }

    // Calculate transitions needed (between different source files)
    let transitionsNeeded = 0;
    for (let i = 1; i < selections.length; i++) {
      if (selections[i].takeId !== selections[i - 1].takeId) {
        transitionsNeeded++;
      }
    }

    // Calculate average score
    const validSelections = selections.filter(s => s.takeId !== null);
    const averageScore = validSelections.length > 0
      ? validSelections.reduce((sum, s) => sum + s.score, 0) / validSelections.length
      : 0;

    const qualityReport: AssemblyQualityReport = {
      averageScore: Math.round(averageScore),
      sectionsWithIssues,
      recommendations
    };

    return {
      sections: selections,
      totalDuration,
      transitionsNeeded,
      qualityReport
    };
  }

  /**
   * Get section text by ID
   */
  private getSectionText(project: MultiTakeProject, sectionId: string): string {
    const section = project.script.sections.find(s => s.id === sectionId);
    if (!section) {
      return 'Unknown section';
    }

    // Return first 50 characters
    return section.text.length > 50
      ? section.text.substring(0, 50) + '...'
      : section.text;
  }

  /**
   * Validate assembly plan is viable
   */
  validateAssemblyPlan(plan: AssemblyPlan): { valid: boolean; error?: string } {
    const missingCount = plan.sections.filter(s => s.takeId === null).length;
    const totalCount = plan.sections.length;

    if (missingCount === totalCount) {
      return {
        valid: false,
        error: 'No sections have coverage - cannot assemble video'
      };
    }

    if (missingCount / totalCount > 0.5) {
      return {
        valid: false,
        error: `${Math.round(missingCount / totalCount * 100)}% of sections are missing - too many gaps to assemble`
      };
    }

    if (plan.totalDuration < 5) {
      return {
        valid: false,
        error: 'Assembled video would be less than 5 seconds'
      };
    }

    return { valid: true };
  }

  /**
   * Get summary of selections
   */
  getSelectionSummary(selections: BestTakeSelection[]): string {
    const covered = selections.filter(s => s.takeId !== null).length;
    const total = selections.length;
    const avgScore = selections
      .filter(s => s.takeId !== null)
      .reduce((sum, s) => sum + s.score, 0) / (covered || 1);

    return `${covered}/${total} sections covered, average score: ${Math.round(avgScore)}`;
  }
}
