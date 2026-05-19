-- Add 'Exhibition' to the sales channel check constraint.
-- Existing values are preserved for backward compatibility with historical data.
alter table sales
  drop constraint if exists sales_channel_check;

alter table sales
  add constraint sales_channel_check
    check (channel in ('Instagram','Walk-in','WhatsApp','Facebook','Website','TikTok','Exhibition'));
