-- QA-NEW-012 — El enum message_type no incluía «interactive», usado por el
-- constructor de mensajes con botones (WhatsApp interactivo). Sin el valor,
-- el INSERT en messages fallaba con «invalid input value for enum message_type».
alter type public.message_type add value if not exists 'interactive';
