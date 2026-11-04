CREATE OR REPLACE FUNCTION get_user_id_by_email(email_addr text)
RETURNS TABLE (id uuid, email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id::uuid,
    u.email::text,
    (u.raw_user_meta_data->>'name')::text
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(email_addr))
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_id_by_email(text) TO service_role;
