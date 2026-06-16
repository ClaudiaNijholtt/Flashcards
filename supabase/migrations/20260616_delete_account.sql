-- Allows a logged-in user to delete their own auth account from the client.
-- SECURITY DEFINER runs as the function owner (postgres), but the WHERE
-- clause pins deletion to auth.uid() so users can only remove themselves.
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Only authenticated users may call this function
REVOKE ALL ON FUNCTION delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
