CREATE TABLE IF NOT EXISTS public.events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL, -- 'whatsapp_click' | 'item_view' | 'booking_start'
  item_id    uuid REFERENCES public.items(id) ON DELETE SET NULL,
  user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  meta       jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Только INSERT с клиента, чтение только для админов
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert events" ON public.events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins read events" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
