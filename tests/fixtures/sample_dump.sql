--
-- Tiny Postgres dump used to test dump_parser. Mirrors the shape of
-- legislink-2026.db but contains only synthetic rows.
--

SET client_encoding = 'UTF8';

CREATE TABLE public.bill (
    id integer NOT NULL,
    bill_number character varying(10),
    title text,
    sponsor text,
    detailed_description text
);

COPY public.bill (id, bill_number, title, sponsor, detailed_description) FROM stdin;
1	HB0001	Tab\tin Title	Rep. Test	First line<hr><ltbullet>two\nlines
2	SB0002	NULL Sponsor	\N	plain text
3	HB0003	Backslash \\ test	Rep. Other	end
\.

CREATE TABLE public."user" (
    id integer NOT NULL,
    username character varying(80),
    email character varying(120)
);

COPY public."user" (id, username, email) FROM stdin;
10	alice	alice@example.com
11	bob	bob@example.com
\.

CREATE TABLE public.legislator (
    id integer,
    username character varying(80),
    legislator_id character varying(20),
    district character varying(20),
    house character varying(1),
    party character varying(20)
);

COPY public.legislator (id, username, legislator_id, district, house, party) FROM stdin;
100	test_legi	TL01	1	H	R
\.
