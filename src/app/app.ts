import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { BirdViewer } from './bird-viewer/bird-viewer';
import { Chalk, Reveal } from './landing/chalk';
import { ChalkBird } from './landing/chalk-bird';
import { DotBird } from './landing/dot-bird';
import { PeekBird } from './landing/peek-bird';
import { PhoneDemo } from './landing/phone-demo';

interface Persona {
  id: string;
  label: string;
  you: string;
  caseId: string;
  court: string;
  event: string;
  alert: string;
}

interface Summary {
  tab: string;
  days: number;
  unit: string;
  verdict: string;
  rows: { title: string; quote: string; source: string }[];
}

interface Draft {
  tab: string;
  heading: string;
  body: string[];
}

@Component({
  selector: 'app-root',
  imports: [BirdViewer, Chalk, ChalkBird, DotBird, PeekBird, PhoneDemo, Reveal],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly personas: Persona[] = [
    {
      id: 'solo',
      label: 'Abogado independiente',
      you: 'Litigas solo, con 40 procesos abiertos en tres materias y dos ciudades.',
      caseId: '17230-2025-04821',
      court: 'U.J. Civil · Quito',
      event: 'Providencia: se admite la reforma a la demanda y se corre traslado.',
      alert: 'Nueva providencia en tu juicio de Quito. Tienes 3 días hábiles para contestar: vence el lunes 30.',
    },
    {
      id: 'firm',
      label: 'Estudio jurídico',
      you: 'Coordinas un estudio de 8 abogados y 300 procesos repartidos entre el equipo.',
      caseId: '09332-2025-01177',
      court: 'U.J. Laboral · Guayaquil',
      event: 'Se señala audiencia única para el 9 de diciembre a las 10:00.',
      alert: 'Audiencia señalada en el caso de María (laboral). La agendé y avisé a su responsable.',
    },
    {
      id: 'corp',
      label: 'Departamento legal',
      you: 'Llevas los litigios de una empresa con causas en todo el país y abogados externos.',
      caseId: '01283-2024-00932',
      court: 'U.J. Civil · Cuenca',
      event: 'Sentencia de primera instancia notificada a las partes.',
      alert: 'Sentencia notificada en Cuenca. Plazo para apelar: 10 días. Te dejo el resumen para el directorio.',
    },
    {
      id: 'para',
      label: 'Asistente o procurador',
      you: 'Cada mañana abres el SATJE y revisas uno por uno los procesos del estudio.',
      caseId: '17294-2025-02210',
      court: 'U.J. Penal · Quito',
      event: 'Razón de notificación y nuevo escrito de la contraparte.',
      alert: 'La contraparte presentó un escrito. No corre plazo todavía, pero ya está en tu lista de hoy.',
    },
  ];
  protected readonly personaId = signal('solo');
  protected readonly persona = computed(() => this.personas.find((p) => p.id === this.personaId())!);

  protected readonly watched = [
    { id: '17230-2025-04821', court: 'U.J. Civil · Quito', last: 'Providencia · hoy 08:52', score: 'Plazo', note: '3 días hábiles', hot: true },
    { id: '09332-2025-01177', court: 'U.J. Laboral · Guayaquil', last: 'Audiencia señalada · hoy', score: 'Audiencia', note: '9 dic · 10:00', hot: true },
    { id: '01283-2024-00932', court: 'U.J. Civil · Cuenca', last: 'Sentencia · ayer 16:20', score: 'Plazo', note: '10 días', hot: true },
    { id: '17294-2025-02210', court: 'U.J. Penal · Quito', last: 'Sin cambios desde el 18/11', score: '—', note: 'Sin novedad', hot: false },
    { id: '18282-2025-00415', court: 'U.J. Civil · Ambato', last: 'Sin cambios desde el 12/11', score: '—', note: 'Sin novedad', hot: false },
    { id: '13284-2025-00733', court: 'U.J. Familia · Manta', last: 'Sin cambios desde el 20/11', score: '—', note: 'Sin novedad', hot: false },
  ];

  protected readonly summaries: Summary[] = [
    {
      tab: 'Reforma a la demanda',
      days: 3,
      unit: 'días hábiles',
      verdict: 'Urgente. Prepara la contestación esta semana.',
      rows: [
        { title: 'Qué pasó', quote: '“Se admite a trámite la reforma a la demanda…”', source: 'Providencia 25/11 08:52' },
        { title: 'Qué te piden', quote: 'Contestar la reforma y anunciar prueba nueva.', source: 'Según el COGEP' },
        { title: 'Cuándo vence', quote: 'Lunes 30 de noviembre, fin del día.', source: 'Calculado en días hábiles' },
        { title: 'Lo que ya sabe QUINDEL', quote: 'Contestaste la demanda el 14/10; hay 3 testigos anunciados.', source: 'Tu expediente' },
      ],
    },
    {
      tab: 'Audiencia señalada',
      days: 14,
      unit: 'días',
      verdict: 'Prepárala con calma. Te recuerdo 48 h antes.',
      rows: [
        { title: 'Qué pasó', quote: '“Se convoca a audiencia única para el 9 de diciembre…”', source: 'Providencia 25/11' },
        { title: 'Qué te piden', quote: 'Comparecer con tu cliente y la prueba anunciada.', source: 'Según el COGEP' },
        { title: 'Dónde', quote: 'Sala 4, Unidad Judicial Laboral, Guayaquil.', source: 'SATJE' },
        { title: 'Lo que ya sabe QUINDEL', quote: 'Es la primera audiencia de este caso.', source: 'Tu expediente' },
      ],
    },
    {
      tab: 'Sentencia',
      days: 10,
      unit: 'días para apelar',
      verdict: 'Revisa la sentencia y decide con tu cliente.',
      rows: [
        { title: 'Qué pasó', quote: '“…se acepta parcialmente la demanda…”', source: 'Sentencia 24/11 16:20' },
        { title: 'Qué te piden', quote: 'Nada obligatorio. Puedes apelar o aclarar.', source: 'Según el COGEP' },
        { title: 'Cuándo vence', quote: 'Apelación: martes 8 de diciembre.', source: 'Calculado en días hábiles' },
        { title: 'Lo que ya sabe QUINDEL', quote: 'Tu cliente pidió que lo llames antes de decidir.', source: 'Nota del 02/11' },
      ],
    },
  ];
  protected readonly summaryIndex = signal(0);
  protected readonly summary = computed(() => this.summaries[this.summaryIndex()]);

  protected readonly drafts: Draft[] = [
    {
      tab: 'Contestación',
      heading: 'SEÑOR JUEZ DE LA UNIDAD JUDICIAL CIVIL CON SEDE EN EL CANTÓN QUITO',
      body: [
        'Juicio No. 17230-2025-04821',
        'Dentro del término concedido en providencia de 25 de noviembre de 2026, comparezco y doy contestación a la reforma a la demanda en los siguientes términos:',
        'PRIMERO.- Niego pura y simplemente los fundamentos de hecho y de derecho de la reforma…',
      ],
    },
    {
      tab: 'Escrito de impulso',
      heading: 'SEÑOR JUEZ DE LA UNIDAD JUDICIAL DE TRABAJO CON SEDE EN EL CANTÓN GUAYAQUIL',
      body: [
        'Juicio No. 09332-2025-01177',
        'Por cuanto ha transcurrido en exceso el término previsto sin que se haya despachado mi escrito de 3 de noviembre, solicito comedidamente se provea lo que en derecho corresponda…',
      ],
    },
    {
      tab: 'Copias certificadas',
      heading: 'SEÑOR JUEZ DE LA UNIDAD JUDICIAL CIVIL CON SEDE EN EL CANTÓN CUENCA',
      body: [
        'Juicio No. 01283-2024-00932',
        'Solicito se confieran a mi costa copias certificadas de la sentencia dictada el 24 de noviembre de 2026 y de su razón de notificación…',
      ],
    },
  ];
  protected readonly draftIndex = signal(0);
  protected readonly draft = computed(() => this.drafts[this.draftIndex()]);

  /** Ten dots per capacity meter. */
  protected readonly ten = Array.from({ length: 10 });

  protected readonly plans = [
    {
      name: 'Independiente',
      icon: 'solo',
      audience: 'Abogado que litiga solo',
      lead: 'Deja de vivir dentro del SATJE. QUINDEL vigila y tú atiendes a tus clientes.',
      meters: [
        { label: 'Procesos', value: 'hasta 60', level: 2 },
        { label: 'Usuarios', value: '1', level: 1 },
      ],
      features: [
        'Alertas por WhatsApp con resumen',
        'Agenda de plazos y audiencias',
        'Historial completo de actuaciones',
        'Expediente digital por caso',
      ],
      note: 'Listo en tu primera demo',
      featured: false,
    },
    {
      name: 'Estudio',
      icon: 'firm',
      audience: 'Firmas de 2 a 15 abogados',
      lead: 'Todo el equipo ve lo mismo, cada caso tiene responsable y nadie se entera tarde.',
      meters: [
        { label: 'Procesos', value: 'hasta 400', level: 6 },
        { label: 'Usuarios', value: 'hasta 12', level: 5 },
      ],
      features: [
        'Todo lo de Independiente',
        'Responsables y avisos por caso',
        'Resúmenes de providencias con IA',
        'Reporte semanal para socios',
      ],
      note: 'Migramos tus procesos por ti',
      featured: true,
    },
    {
      name: 'Corporativo',
      icon: 'corp',
      audience: 'Departamentos legales',
      lead: 'Control de toda la cartera de litigios, incluidos los abogados externos.',
      meters: [
        { label: 'Procesos', value: 'sin límite', level: 10 },
        { label: 'Usuarios', value: 'sin límite', level: 10 },
      ],
      features: [
        'Todo lo de Estudio',
        'Control de abogados externos',
        'Borradores de escritos con IA',
        'Reportes para directorio y acompañamiento',
      ],
      note: 'Implementación acompañada',
      featured: false,
    },
  ];

  protected readonly faqs = [
    {
      q: '¿QUINDEL presenta escritos o actúa en mi nombre?',
      a: 'No. QUINDEL vigila, resume y prepara borradores. Revisar, firmar y presentar siempre es decisión tuya.',
    },
    {
      q: '¿De dónde saca la información?',
      a: 'De la consulta pública de causas del SATJE de la Función Judicial. Cada alerta indica la actuación y la fecha de la que sale, para que la verifiques.',
    },
    {
      q: '¿Necesito instalar algo?',
      a: 'No. Las alertas llegan a tu WhatsApp y el panel funciona en cualquier navegador. En la demo registramos tus primeros procesos contigo.',
    },
    {
      q: '¿Cómo calcula los plazos?',
      a: 'Cuenta días hábiles según el tipo de actuación y la norma aplicable, y te muestra cómo llegó a esa fecha. Es una ayuda: el cómputo final lo confirmas tú.',
    },
    {
      q: '¿Qué pasa con la información de mis clientes?',
      a: 'Se cifra en tránsito y en reposo, se trata conforme a la Ley Orgánica de Protección de Datos Personales y nunca se usa para entrenar modelos de terceros.',
    },
    {
      q: '¿Por qué no hay precios publicados?',
      a: 'Porque dependen de cuántos procesos llevas y cuántas personas los usan. En la demo de 20 minutos vemos tu caso y te damos una propuesta cerrada.',
    },
  ];

  protected readonly sent = signal(false);

  protected submit(e: Event): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    if (!form.reportValidity()) return;
    // TODO: send to the CRM / calendar backend once it exists.
    this.sent.set(true);
  }
}
