import { Component, signal } from '@angular/core';
import { BirdViewer } from './bird-viewer/bird-viewer';
import { RobotViewer } from './robot-viewer/robot-viewer';

@Component({
  selector: 'app-root',
  imports: [BirdViewer, RobotViewer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly model = signal<'bird' | 'robot'>('bird');
}
