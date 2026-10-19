import { Injectable, signal } from "@angular/core";

export interface TextViewModalState {
  visible: boolean;
  title: string;
  text: string;
}

@Injectable({ providedIn: "root" })
export class TextViewModalService {
  readonly state = signal<TextViewModalState>({
    visible: false,
    title: "",
    text: "",
  });

  open(text: string, title = "Detalle"): void {
    this.state.set({
      visible: true,
      title,
      text,
    });
  }

  close(): void {
    this.state.update((current) => ({ ...current, visible: false }));
  }
}
