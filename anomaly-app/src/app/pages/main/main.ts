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
  selectedFrequency = 'daily';
  selectedPeriod = 'max';

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
    }, 300);
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
    // Get all data for the feature
    let featureData = data.filter(item => item.Feature === featureName);
    
    // Apply time period filter
    featureData = this.applyTimePeriodFilter(featureData);
    
    // Apply frequency filter
    featureData = this.applyFrequencyFilter(featureData);

    this.selectedFeatureData = featureData;

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
    }, 200);
    
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
    }, 200);
    
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
        this.newsData = response;
        this.isLoadingNews = false;
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

  onFrequencyChange() {
    // Reload chart data with new frequency
    if (this.selectedItemId) {
      const selectedItem = this.data.find(item => item.id === this.selectedItemId);
      if (selectedItem) {
        this.loadChartData(selectedItem.name);
      }
    }
  }

  selectPeriod(period: string) {
    this.selectedPeriod = period;
    // Reload chart data with new period
    if (this.selectedItemId) {
      const selectedItem = this.data.find(item => item.id === this.selectedItemId);
      if (selectedItem) {
        this.loadChartData(selectedItem.name);
      }
    }
  }

  applyTimePeriodFilter(data: any[]): any[] {
    if (!data || data.length === 0) return data;

    // Sort by date first
    const sortedData = data.sort((a, b) => new Date(b.date_of_use).getTime() - new Date(a.date_of_use).getTime());
    const latestDate = new Date(sortedData[0].date_of_use);
    const earliestDate = new Date(sortedData[sortedData.length - 1].date_of_use);
    
    let cutoffDate: Date;
    
    switch (this.selectedPeriod) {
      case '30D':
        cutoffDate = new Date(latestDate.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '3M':
        cutoffDate = new Date(latestDate.getTime() - (90 * 24 * 60 * 60 * 1000));
        break;
      case '6M':
        cutoffDate = new Date(latestDate.getTime() - (180 * 24 * 60 * 60 * 1000));
        break;
      case 'max':
        return data; // Return all data for max period
      default:
        return data;
    }
    
    // If the cutoff date is before our earliest data, just return all data
    if (cutoffDate < earliestDate) {
      return data;
    }
    
    const filteredData = data.filter(item => new Date(item.date_of_use) >= cutoffDate);
    return filteredData;
  }

  applyFrequencyFilter(data: any[]): any[] {
    if (!data || data.length === 0) return data;
    
    // Sort by date first
    const sortedData = data.sort((a, b) => new Date(a.date_of_use).getTime() - new Date(b.date_of_use).getTime());
    
    switch (this.selectedFrequency) {
      case 'daily':
        return sortedData; // Return all daily data
      
      case 'weekly':
        return this.aggregateToWeekly(sortedData);
      
      case 'monthly':
        return this.aggregateToMonthly(sortedData);
      
      default:
        return sortedData;
    }
  }

  aggregateToWeekly(data: any[]): any[] {
    const weeklyData: any[] = [];
    const weekGroups = new Map<string, any[]>();
    
    data.forEach(item => {
      const date = new Date(item.date_of_use);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weekGroups.has(weekKey)) {
        weekGroups.set(weekKey, []);
      }
      weekGroups.get(weekKey)!.push(item);
    });
    
    weekGroups.forEach((weekData, weekKey) => {
      if (weekData.length > 0) {
        const avgDistinctCID = weekData.reduce((sum, item) => sum + item.distinct_CID_count, 0) / weekData.length;
        const hasAnomaly = weekData.some(item => item.is_anomaly === "True");
        
        weeklyData.push({
          ...weekData[0], // Use first item as base
          date_of_use: weekKey,
          distinct_CID_count: Math.round(avgDistinctCID),
          is_anomaly: hasAnomaly ? "True" : "False"
        });
      }
    });
    
    return weeklyData.sort((a, b) => new Date(a.date_of_use).getTime() - new Date(b.date_of_use).getTime());
  }

  aggregateToMonthly(data: any[]): any[] {
    const monthlyData: any[] = [];
    const monthGroups = new Map<string, any[]>();
    
    data.forEach(item => {
      const date = new Date(item.date_of_use);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthGroups.has(monthKey)) {
        monthGroups.set(monthKey, []);
      }
      monthGroups.get(monthKey)!.push(item);
    });
    
    monthGroups.forEach((monthData, monthKey) => {
      if (monthData.length > 0) {
        const avgDistinctCID = monthData.reduce((sum, item) => sum + item.distinct_CID_count, 0) / monthData.length;
        const hasAnomaly = monthData.some(item => item.is_anomaly === "True");
        
        monthlyData.push({
          ...monthData[0], // Use first item as base
          date_of_use: `${monthKey}-01`, // First day of month
          distinct_CID_count: Math.round(avgDistinctCID),
          is_anomaly: hasAnomaly ? "True" : "False"
        });
      }
    });
    
    return monthlyData.sort((a, b) => new Date(a.date_of_use).getTime() - new Date(b.date_of_use).getTime());
  }


  createMiniCharts() {
    // Wait for DOM to be ready
    setTimeout(() => {
      this.filteredData.forEach((item, index) => {
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
              
              try {
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
                    maintainAspectRatio: false,
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
                    },
                    layout: {
                      padding: 2
                    }
                  }
                });
              } catch (error) {
                console.error(`❌ Error creating chart for ${item.name}:`, error);
              }
            }
          } else {
            console.error(`Could not get context for canvas ${canvasId}`);
          }
        } else {
          console.error(`Canvas ${canvasId} not found`);
        }
      });
    }, 100);
  }
}
