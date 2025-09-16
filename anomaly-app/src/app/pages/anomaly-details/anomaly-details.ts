import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }
}
