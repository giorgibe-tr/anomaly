import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnomalyDetails } from './anomaly-details';

describe('AnomalyDetails', () => {
  let component: AnomalyDetails;
  let fixture: ComponentFixture<AnomalyDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnomalyDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnomalyDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
