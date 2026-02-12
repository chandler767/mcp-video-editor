import {
  MultiTakeProject,
  TakeAnalysis,
  BestTakeSelection,
  AssemblyPlan,
  TakeIssue,
  ScriptSection
} from '../multi-take/multi-take-types.js';
import { QualityScorer } from '../quality/scoring.js';

/**
 * Generate human-readable reports for multi-take analysis
 */
export class ReportGenerator {
  private qualityScorer: QualityScorer;

  constructor() {
    this.qualityScorer = new QualityScorer();
  }

  /**
   * Generate project overview report
   */
  generateProjectOverview(project: MultiTakeProject): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push(`PROJECT: ${project.name}`);
    lines.push('='.repeat(80));
    lines.push('');

    lines.push(`Project ID: ${project.projectId}`);
    lines.push(`Created: ${project.created.toLocaleString()}`);
    lines.push(`Modified: ${project.modified.toLocaleString()}`);
    lines.push(`Status: ${project.status.phase} (${project.status.progress}%)`);
    lines.push('');

    lines.push('SCRIPT:');
    lines.push(`  Sections: ${project.script.sections.length}`);
    lines.push(`  Total length: ${project.script.fullScript.length} characters`);
    lines.push('');

    lines.push('TAKES:');
    lines.push(`  Total: ${project.takes.length}`);
    lines.push(`  Analyzed: ${project.takes.filter(t => t.status === 'analyzed').length}`);
    lines.push(`  Pending: ${project.takes.filter(t => t.status === 'pending').length}`);
    lines.push(`  Errors: ${project.takes.filter(t => t.status === 'error').length}`);
    lines.push('');

    if (project.takes.length > 0) {
      const avgScore = project.takes
        .filter(t => t.status === 'analyzed')
        .reduce((sum, t) => sum + t.overallScore, 0) / project.takes.length;

      lines.push('QUALITY:');
      lines.push(`  Average Score: ${Math.round(avgScore)}/100 (${this.qualityScorer.getLetterGrade(avgScore)})`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate detailed analysis report for all takes
   */
  generateAnalysisReport(project: MultiTakeProject): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('TAKE ANALYSIS REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    for (const take of project.takes) {
      lines.push(this.generateTakeReport(take));
      lines.push('');
      lines.push('-'.repeat(80));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate report for a single take
   */
  generateTakeReport(take: TakeAnalysis): string {
    const lines: string[] = [];

    lines.push(`TAKE: ${take.fileName}`);
    lines.push(`  ID: ${take.takeId}`);
    lines.push(`  Status: ${take.status}`);

    if (take.status === 'error') {
      lines.push(`  Error: ${take.error}`);
      return lines.join('\n');
    }

    lines.push(`  Overall Score: ${take.overallScore}/100 (${this.qualityScorer.getLetterGrade(take.overallScore)})`);
    lines.push('');

    // Audio quality
    lines.push('  AUDIO QUALITY:');
    lines.push(`    Clarity: ${Math.round(take.audioQuality.clarity.score)}/100`);
    lines.push(`    Volume: ${Math.round(take.audioQuality.volumeLevel.average)}dB (consistency: ${Math.round(take.audioQuality.volumeLevel.consistency * 100)}%)`);
    lines.push(`    Speaking Pace: ${Math.round(take.audioQuality.speechQuality.pace)} WPM`);
    lines.push(`    Filler Words: ${take.audioQuality.speechQuality.fillerWords.count} (${Math.round(take.audioQuality.speechQuality.fillerWords.rate)}/min)`);
    lines.push('');

    // Video quality
    lines.push('  VIDEO QUALITY:');
    lines.push(`    Resolution: ${take.videoQuality.technical.resolution.width}x${take.videoQuality.technical.resolution.height}`);
    lines.push(`    FPS: ${Math.round(take.videoQuality.technical.fps)}`);
    lines.push(`    Codec: ${take.videoQuality.technical.codec}`);
    lines.push(`    Sharpness: ${take.videoQuality.visual.sharpness}/100`);
    lines.push(`    Brightness: ${take.videoQuality.visual.brightness}/100`);
    lines.push(`    Stabilization: ${take.videoQuality.visual.stabilization}/100`);
    lines.push('');

    // Coverage
    lines.push('  COVERAGE:');
    lines.push(`    Script Coverage: ${Math.round(take.coverage.scriptCoverage * 100)}%`);
    lines.push(`    Covered Sections: ${take.coverage.coveredSections.length}`);
    lines.push(`    Missing Sections: ${take.coverage.missingSections.length}`);
    lines.push('');

    // Issues
    if (take.issues.length > 0) {
      lines.push('  ISSUES:');
      const errors = take.issues.filter(i => i.severity === 'error');
      const warnings = take.issues.filter(i => i.severity === 'warning');
      const info = take.issues.filter(i => i.severity === 'info');

      if (errors.length > 0) {
        lines.push(`    Errors (${errors.length}):`);
        errors.forEach(issue => {
          lines.push(`      - ${issue.description}`);
          if (issue.suggestion) {
            lines.push(`        → ${issue.suggestion}`);
          }
        });
      }

      if (warnings.length > 0) {
        lines.push(`    Warnings (${warnings.length}):`);
        warnings.forEach(issue => {
          lines.push(`      - ${issue.description}`);
        });
      }

      if (info.length > 0) {
        lines.push(`    Info (${info.length}):`);
        info.forEach(issue => {
          lines.push(`      - ${issue.description}`);
        });
      }
    } else {
      lines.push('  ISSUES: None detected');
    }

    return lines.join('\n');
  }

  /**
   * Generate coverage report
   */
  generateCoverageReport(project: MultiTakeProject): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('SCRIPT COVERAGE REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    for (const section of project.script.sections) {
      const takesWithSection = project.takes.filter(t =>
        t.coverage.coveredSections.includes(section.id)
      );

      lines.push(`SECTION ${project.script.sections.indexOf(section) + 1}:`);
      lines.push(`  Text: ${section.text.substring(0, 100)}${section.text.length > 100 ? '...' : ''}`);
      lines.push(`  Coverage: ${takesWithSection.length} take(s)`);

      if (takesWithSection.length > 0) {
        lines.push('  Available in:');
        takesWithSection.forEach(take => {
          const match = take.scriptMatches.find(m => m.sectionId === section.id);
          const quality = match ? Math.round(match.quality) : 0;
          lines.push(`    - ${take.fileName} (quality: ${quality}/100, overall: ${take.overallScore}/100)`);
        });
      } else {
        lines.push('  ⚠️  NOT COVERED - Need to record this section');
      }

      lines.push('');
    }

    // Summary
    const coveredSections = new Set<string>();
    project.takes.forEach(take => {
      take.coverage.coveredSections.forEach(id => coveredSections.add(id));
    });

    const coveragePercent = (coveredSections.size / project.script.sections.length) * 100;
    lines.push('SUMMARY:');
    lines.push(`  Overall Coverage: ${Math.round(coveragePercent)}%`);
    lines.push(`  Sections Covered: ${coveredSections.size}/${project.script.sections.length}`);
    lines.push(`  Missing Sections: ${project.script.sections.length - coveredSections.size}`);

    return lines.join('\n');
  }

  /**
   * Generate assembly plan report
   */
  generateAssemblyReport(project: MultiTakeProject, plan: AssemblyPlan): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('ASSEMBLY PLAN');
    lines.push('='.repeat(80));
    lines.push('');

    lines.push('OVERVIEW:');
    lines.push(`  Total Duration: ${this.formatDuration(plan.totalDuration)}`);
    lines.push(`  Sections: ${plan.sections.length}`);
    lines.push(`  Transitions: ${plan.transitionsNeeded}`);
    lines.push(`  Average Quality: ${plan.qualityReport.averageScore}/100 (${this.qualityScorer.getLetterGrade(plan.qualityReport.averageScore)})`);
    lines.push('');

    if (plan.qualityReport.sectionsWithIssues.length > 0) {
      lines.push(`⚠️  ISSUES (${plan.qualityReport.sectionsWithIssues.length}):`);
      plan.qualityReport.recommendations.forEach(rec => {
        lines.push(`  - ${rec}`);
      });
      lines.push('');
    }

    lines.push('SELECTED TAKES:');
    lines.push('');

    let currentTakeId: string | null = null;
    let sectionIndex = 1;

    for (const selection of plan.sections) {
      const section = project.script.sections.find(s => s.id === selection.sectionId);

      if (selection.takeId !== currentTakeId) {
        if (currentTakeId !== null) {
          lines.push('');
        }

        const take = project.takes.find(t => t.takeId === selection.takeId);
        if (take) {
          lines.push(`FROM: ${take.fileName} (score: ${take.overallScore}/100)`);
        } else {
          lines.push('FROM: [No suitable take found]');
        }
        currentTakeId = selection.takeId;
      }

      const sectionText = section
        ? section.text.substring(0, 60) + (section.text.length > 60 ? '...' : '')
        : 'Unknown section';

      const timeRange = selection.segment
        ? `${this.formatTime(selection.segment.start)} - ${this.formatTime(selection.segment.end)}`
        : 'N/A';

      lines.push(`  ${sectionIndex}. ${sectionText}`);
      lines.push(`     Time: ${timeRange} | Score: ${Math.round(selection.score)}/100`);

      sectionIndex++;
    }

    return lines.join('\n');
  }

  /**
   * Generate issues report
   */
  generateIssuesReport(project: MultiTakeProject): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('ISSUES REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    const allIssues = project.takes.flatMap(take =>
      take.issues.map(issue => ({ ...issue, take }))
    );

    const errors = allIssues.filter(i => i.severity === 'error');
    const warnings = allIssues.filter(i => i.severity === 'warning');
    const info = allIssues.filter(i => i.severity === 'info');

    lines.push(`Total Issues: ${allIssues.length}`);
    lines.push(`  Errors: ${errors.length}`);
    lines.push(`  Warnings: ${warnings.length}`);
    lines.push(`  Info: ${info.length}`);
    lines.push('');

    if (errors.length > 0) {
      lines.push('ERRORS:');
      errors.forEach(issue => {
        lines.push(`  ❌ ${issue.take.fileName}: ${issue.description}`);
        if (issue.suggestion) {
          lines.push(`     → ${issue.suggestion}`);
        }
      });
      lines.push('');
    }

    if (warnings.length > 0) {
      lines.push('WARNINGS:');
      warnings.forEach(issue => {
        lines.push(`  ⚠️  ${issue.take.fileName}: ${issue.description}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format duration in seconds to MM:SS
   */
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format time in seconds to MM:SS
   */
  private formatTime(seconds: number): string {
    return this.formatDuration(seconds);
  }

  /**
   * Generate JSON report (machine-readable)
   */
  generateJSONReport(project: MultiTakeProject, plan?: AssemblyPlan): string {
    const report: any = {
      project: {
        id: project.projectId,
        name: project.name,
        created: project.created,
        modified: project.modified,
        status: project.status
      },
      script: {
        sections: project.script.sections.length,
        totalLength: project.script.fullScript.length
      },
      takes: project.takes.map(take => ({
        id: take.takeId,
        fileName: take.fileName,
        status: take.status,
        overallScore: take.overallScore,
        coverage: Math.round(take.coverage.scriptCoverage * 100),
        issues: {
          errors: take.issues.filter(i => i.severity === 'error').length,
          warnings: take.issues.filter(i => i.severity === 'warning').length,
          info: take.issues.filter(i => i.severity === 'info').length
        }
      }))
    };

    if (plan) {
      report.assembly = {
        totalDuration: plan.totalDuration,
        transitions: plan.transitionsNeeded,
        averageQuality: plan.qualityReport.averageScore,
        sectionsWithIssues: plan.qualityReport.sectionsWithIssues.length,
        selections: plan.sections.map(s => ({
          sectionId: s.sectionId,
          takeId: s.takeId,
          score: s.score,
          duration: s.segment ? s.segment.end - s.segment.start : 0
        }))
      };
    }

    return JSON.stringify(report, null, 2);
  }
}
