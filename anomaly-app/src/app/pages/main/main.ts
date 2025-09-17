import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDrawerContainer, MatDrawer, MatDrawerContent } from '@angular/material/sidenav';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { data } from './data';
import { Chart, registerables } from 'chart.js';
import { AnomalyDetails } from '../anomaly-details/anomaly-details';

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
  selector: 'app-main',
  imports: [CommonModule, FormsModule, MatInputModule, MatFormFieldModule, MatIconModule, AnomalyDetails, HttpClientModule],
  templateUrl: './main.html',
  styleUrl: './main.less'
})
export class Main implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  value = '';
  data = this.getUniqueFeatures();
  filteredData = this.data;
  selectedItemId: number | null = null;
  chart: Chart | null = null;
  selectedFeatureData: any[] = [];
  showAnomalyDetails = false;
  selectedAnomalyData: any = null;
  analyzedPeriodData: any = null;
  newsData: NewsResponse | null = null;
  isLoadingNews = false;
  miniCharts: Chart[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    Chart.register(...registerables);
    
    // Select the first item by default
    if (this.data.length > 0) {
      this.selectedItemId = this.data[0].id;
      this.loadChartData(this.data[0].name);
    }
    
    // Create mini charts after a short delay
    setTimeout(() => {
      this.createMiniCharts();
    }, 200);
  }

  ngAfterViewInit() {
    // Mini charts are created in ngOnInit
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
          secondNumber: Math.round(item.z_score * 100) / 100, // Z-score for percentage display
          anomalyScore: item.anomaly_score,
          isAnomaly: item.is_anomaly === "True",
          anomalySeverity: item.anomaly_severity
        });
      }
    });
    
    const uniqueFeatures = Array.from(featureMap.values());
    console.log('Unique features found:', uniqueFeatures.length);
    console.log('Feature names:', uniqueFeatures.map(f => f.name));
    
    return uniqueFeatures;
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
    // Always show all data for the feature
    this.selectedFeatureData = data.filter(item => item.Feature === featureName);

    console.log('All data for feature:', featureName, this.selectedFeatureData.length, 'records');

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
    const percentages = this.selectedFeatureData.map(item => item.distinct_CID_count);
    const severities = this.selectedFeatureData.map(item => item.anomaly_severity);

    if (this.selectedFeatureData.length === 0) {
      console.log('No data to display in chart');
      // Show a message or create a placeholder chart
      this.createEmptyChart(ctx);
      return;
    }

    // Create point colors and visibility based on anomaly status
    const pointBackgroundColors = this.selectedFeatureData.map(item => {
      if (item.is_anomaly === "True") {
        // Show points only for anomalies with color based on severity
        switch(item.anomaly_severity) {
          case 'Normal': return '#10b981'; // Emerald green
          case 'Low': return '#f59e0b';    // Amber
          case 'Medium': return '#ef4444'; // Red-500
          default: return '#1976d2';       // Default blue
        }
      } else {
        // Hide points for non-anomalies (transparent)
        return 'transparent';
      }
    });

    const pointBorderColors = this.selectedFeatureData.map(item => {
      if (item.is_anomaly === "True") {
        // Show border only for anomalies
        switch(item.anomaly_severity) {
          case 'Normal': return '#10b981'; // Emerald green
          case 'Low': return '#f59e0b';    // Amber
          case 'Medium': return '#ef4444'; // Red-500
          default: return '#1976d2';       // Default blue
        }
      } else {
        // Hide border for non-anomalies
        return 'transparent';
      }
    });

    // Create point radius array - show points only for anomalies
    const pointRadius = this.selectedFeatureData.map(item => 
      item.is_anomaly === "True" ? 6 : 0
    );

    const pointHoverRadius = this.selectedFeatureData.map(item => 
      item.is_anomaly === "True" ? 8 : 0
    );

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Distinct CID Count',
          data: percentages,
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: pointBackgroundColors,
          pointBorderColor: pointBorderColors,
          pointRadius: pointRadius,
          pointHoverRadius: pointHoverRadius
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
              text: 'Distinct CID Count'
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
            
            // Only allow clicking on anomaly points
            if (clickedData.is_anomaly === "True") {
              this.onPointClick(clickedData, dataIndex);
            }
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
      distinctCIDCount: clickedData.distinct_CID_count,
      severity: clickedData.anomaly_severity,
      isAnomaly: clickedData.is_anomaly,
      zScore: clickedData.z_score
    });

    // Calculate analyzed period data for the current feature
    this.calculateAnalyzedPeriod(clickedData.Feature);

    // Fetch news data for the clicked date
    this.fetchNewsData(clickedData.date_of_use);

    // Show the anomaly details popup
    this.selectedAnomalyData = clickedData;
    this.showAnomalyDetails = true;
  }

  onCloseAnomalyDetails() {
    this.showAnomalyDetails = false;
    this.selectedAnomalyData = null;
    this.analyzedPeriodData = null;
    this.newsData = null;
  }

  onSearchChange() {
    if (!this.value || this.value.trim() === '') {
      this.filteredData = this.data;
    } else {
      const searchTerm = this.value.toLowerCase().trim();
      this.filteredData = this.data.filter(item => 
        item.name.toLowerCase().includes(searchTerm)
      );
    }
    
    // Recreate mini charts for filtered data
    setTimeout(() => {
      this.createMiniCharts();
    }, 100);
    
    // If current selection is not in filtered results, select first item from filtered results
    if (this.selectedItemId && !this.filteredData.find(item => item.id === this.selectedItemId)) {
      if (this.filteredData.length > 0) {
        // Select first item from filtered results
        this.selectedItemId = this.filteredData[0].id;
        this.loadChartData(this.filteredData[0].name);
      } else {
        // No results, clear selection
        this.selectedItemId = null;
        this.clearChart();
      }
    } else if (!this.selectedItemId && this.filteredData.length > 0) {
      // If no current selection and we have filtered results, select first item
      this.selectedItemId = this.filteredData[0].id;
      this.loadChartData(this.filteredData[0].name);
    }
  }

  clearSearch() {
    this.value = '';
    this.filteredData = this.data;
    
    // Recreate mini charts
    setTimeout(() => {
      this.createMiniCharts();
    }, 100);
    
    // Select first item from all data when clearing search
    if (this.filteredData.length > 0) {
      this.selectedItemId = this.filteredData[0].id;
      this.loadChartData(this.filteredData[0].name);
    }
  }

  fetchNewsData(dateString: string) {
    this.isLoadingNews = true;
    this.newsData = null;

    // Format date from YYYY-MM-DD to YYYYMMDD
    const formattedDate = dateString.replace(/-/g, '');
    //const formattedDate = "20250916";
    
    const apiUrl = `https://qa-2-n8n-ingress.dev.local/webhook/GetNews?date=${formattedDate}`;
    
    this.http.get<NewsResponse>(apiUrl).subscribe({
      next: (response: NewsResponse) => {
        console.log('Raw API response:', response);
        console.log('Response type:', typeof response);
        console.log('Response keys:', Object.keys(response));
        this.newsData = response;
        this.isLoadingNews = false;
        console.log('News data set:', this.newsData);
      },
      error: (error) => {
        console.error('Error fetching news data:', error);
        this.isLoadingNews = false;
        this.newsData = { 
          output: {
            MarketSentiment: 'Error',
            DebugData: {
              newsSummary: 'Failed to fetch news data',
              overallAverageImpact: '0',
              totalArticles: '0'
            },
            NewsSummary: 'Error loading news data'
          },
          error: 'Failed to fetch news data'
        };
      }
    });
  }

  calculateAnalyzedPeriod(featureName: string) {
    // Get all data for this feature
    const featureData = data.filter(item => item.Feature === featureName);
    
    if (featureData.length === 0) {
      this.analyzedPeriodData = null;
      return;
    }

    // Sort by date
    const sortedData = featureData.sort((a, b) => new Date(a.date_of_use).getTime() - new Date(b.date_of_use).getTime());
    
    // Get date range
    const startDate = sortedData[0].date_of_use;
    const endDate = sortedData[sortedData.length - 1].date_of_use;
    
    // Calculate duration
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Count anomalies
    const anomalyPoints = featureData.filter(item => item.is_anomaly === "True").length;
    
    // Format duration
    let duration = '';
    if (diffDays === 0) {
      duration = 'Same day';
    } else if (diffDays === 1) {
      duration = '1 day';
    } else if (diffDays < 30) {
      duration = `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      duration = `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      duration = `${years} year${years > 1 ? 's' : ''}`;
    }

    this.analyzedPeriodData = {
      startDate: startDate,
      endDate: endDate,
      duration: duration,
      totalPoints: featureData.length,
      anomalyPoints: anomalyPoints
    };
  }

  clearChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.selectedFeatureData = [];
  }


  createMiniCharts() {
    this.filteredData.forEach(item => {
      const canvasId = `miniChart${item.id}`;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Get data for this feature
          const featureData = data.filter(d => d.Feature === item.name);
          const sortedData = featureData.sort((a, b) => new Date(a.date_of_use).getTime() - new Date(b.date_of_use).getTime());
          
          if (sortedData.length > 0) {
            // Reduce data points for mini chart - take every 3rd point, max 10 points
            const everyThirdData = sortedData.filter((_, index) => index % 3 === 0);
            const finalData = everyThirdData.slice(0, 10); // Limit to 10 points max
            const values = finalData.map(d => d.distinct_CID_count);
            
            // Create simple mini chart
            new Chart(ctx, {
              type: 'line',
              data: {
                labels: values.map((_, i) => i.toString()),
                datasets: [{
                  data: values,
                  borderColor: '#1976d2',
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  fill: false,
                  pointRadius: 0,
                  tension: 0.4
                }]
              },
              options: {
                responsive: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { enabled: false }
                },
                scales: {
                  x: { display: false },
                  y: { display: false }
                },
                elements: {
                  line: {
                    borderWidth: 1.5
                  }
                }
              }
            });
          }
        }
      }
    });
  }
}
