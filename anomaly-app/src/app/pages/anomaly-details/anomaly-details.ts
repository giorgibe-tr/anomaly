import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

interface NewsResponse {
  output: {
    MarketSentiment: string;
    DebugData: {
      newsSummary: string;
      overallAverageImpact: string;
      totalArticles: string;
    };
    NewsSummary: string;
  };
  error?: string;
}

@Component({
  selector: 'app-anomaly-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './anomaly-details.html',
  styleUrl: './anomaly-details.less'
})
export class AnomalyDetails {
  @Input() isVisible = false;
  @Input() anomalyData: any = null;
  @Input() analyzedPeriod: any = null;
  @Input() newsData: NewsResponse | null = null;
  @Input() isLoadingNews = false;
  @Output() close = new EventEmitter<void>();

  isAnalysisExpanded = false;

  onClose() {
    this.close.emit();
  }

  toggleAnalysis() {
    this.isAnalysisExpanded = !this.isAnalysisExpanded;
  }
}
