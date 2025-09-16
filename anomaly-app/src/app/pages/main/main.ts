import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDrawerContainer, MatDrawer, MatDrawerContent } from '@angular/material/sidenav';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { data } from './data';
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-main',
  imports: [CommonModule, FormsModule, MatInputModule, MatFormFieldModule, MatIconModule],
  templateUrl: './main.html',
  styleUrl: './main.less'
})
export class Main implements OnInit {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  value = '';
  data = this.getUniqueFeatures();
  selectedItemId: number | null = null;
  chart: Chart | null = null;
  selectedFeatureData: any[] = [];

  ngOnInit() {
    Chart.register(...registerables);
    
    // Select the first item by default
    if (this.data.length > 0) {
      this.selectedItemId = this.data[0].id;
      this.loadChartData(this.data[0].name);
    }
  }

  getUniqueFeatures() {
    // Group data by feature and get unique features
    const featureMap = new Map();
    
    data.forEach(item => {
      const feature = item.Feature;
      if (!featureMap.has(feature)) {
        featureMap.set(feature, {
          id: featureMap.size + 1,
          name: feature,
          firstNumber: item.distinct_CID_count,
          secondNumber: Math.round(item.z_score * 100) / 100, // Round to 2 decimal places
          anomalyScore: item.anomaly_score,
          isAnomaly: item.is_anomaly === "True",
          anomalySeverity: item.anomaly_severity
        });
      }
    });
    
    return Array.from(featureMap.values());
  }

  selectItem(itemId: number) {
    this.selectedItemId = this.selectedItemId === itemId ? null : itemId;
    
    if (this.selectedItemId) {
      const selectedItem = this.data.find(item => item.id === itemId);
      if (selectedItem) {
        this.loadChartData(selectedItem.name);
      }
    } else {
      this.clearChart();
    }
  }

  isItemSelected(itemId: number): boolean {
    return this.selectedItemId === itemId;
  }

  loadChartData(featureName: string) {
    // First try to filter data by feature and is_anomaly = true
    this.selectedFeatureData = data.filter(item => 
      item.Feature === featureName && item.is_anomaly === "True"
    );

    console.log('Anomaly data for feature:', featureName, this.selectedFeatureData.length, 'records');

    // If no anomalies found, show all data for the feature
    if (this.selectedFeatureData.length === 0) {
      this.selectedFeatureData = data.filter(item => item.Feature === featureName);
      console.log('No anomalies found, showing all data for feature:', featureName, this.selectedFeatureData.length, 'records');
    }

    // Sort by date
    this.selectedFeatureData.sort((a, b) => new Date(a.date_of_use).getTime() - new Date(b.date_of_use).getTime());

    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      this.createChart();
    }, 100);
  }

  createChart() {
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    const labels = this.selectedFeatureData.map(item => item.date_of_use);
    const percentages = this.selectedFeatureData.map(item => item.z_score);
    const severities = this.selectedFeatureData.map(item => item.anomaly_severity);

    if (this.selectedFeatureData.length === 0) {
      console.log('No data to display in chart');
      // Show a message or create a placeholder chart
      this.createEmptyChart(ctx);
      return;
    }

    // Create point colors based on severity
    const pointBackgroundColors = severities.map(severity => {
      switch(severity) {
        case 'Normal': return '#10b981'; // Emerald green
        case 'Low': return '#f59e0b';    // Amber
        case 'Medium': return '#ef4444'; // Red-500
        default: return '#1976d2';       // Default blue
      }
    });

    const pointBorderColors = pointBackgroundColors; // Same as background

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Anomaly Score (%)',
          data: percentages,
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: pointBackgroundColors,
          pointBorderColor: pointBorderColors,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Z-Score (%)'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Anomaly Trends - ${this.selectedFeatureData[0]?.Feature || 'Selected Feature'}`
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              generateLabels: (chart) => {
                return [
                  {
                    text: 'Normal',
                    fillStyle: '#10b981',
                    strokeStyle: '#10b981',
                    pointStyle: 'circle'
                  },
                  {
                    text: 'Low',
                    fillStyle: '#f59e0b',
                    strokeStyle: '#f59e0b',
                    pointStyle: 'circle'
                  },
                  {
                    text: 'Medium',
                    fillStyle: '#ef4444',
                    strokeStyle: '#ef4444',
                    pointStyle: 'circle'
                  }
                ];
              }
            }
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const element = elements[0];
            const dataIndex = element.index;
            const clickedData = this.selectedFeatureData[dataIndex];
            this.onPointClick(clickedData, dataIndex);
          }
        }
      }
    });
  }

  createEmptyChart(ctx: CanvasRenderingContext2D) {
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['No Data'],
        datasets: [{
          label: 'No Data Available',
          data: [0],
          borderColor: '#ccc',
          backgroundColor: 'rgba(200, 200, 200, 0.1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'No Data Available for Selected Feature'
          }
        }
      }
    });
  }

  onPointClick(clickedData: any, dataIndex: number) {
    console.log('Point clicked:', {
      index: dataIndex,
      date: clickedData.date_of_use,
      zScore: clickedData.z_score,
      severity: clickedData.anomaly_severity,
      isAnomaly: clickedData.is_anomaly,
      distinctCIDCount: clickedData.distinct_CID_count
    });

    // You can add your custom logic here
    // For example:
    // - Show a modal with detailed information
    // - Navigate to a details page
    // - Update other components
    // - Show a tooltip with more data
    
    // Example: Show an alert with the data
    alert(`Point ${dataIndex + 1} clicked!\nDate: ${clickedData.date_of_use}\nZ-Score: ${clickedData.z_score}\nSeverity: ${clickedData.anomaly_severity}`);
  }

  clearChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.selectedFeatureData = [];
  }
}
