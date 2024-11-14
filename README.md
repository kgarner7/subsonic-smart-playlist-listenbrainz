# Subsonic Smart Playlist Generator - Powered By ListenBrainz (Troi)

An OpenSubsonic Smart Playlist generator powered by [Troi](https://github.com/metabrainz/troi-recommendation-playground) and ListenBrainz/MusicBrainz.

This is a modified wrapper with a UI.

## Server Requirements

Usage of this application requires an OpenSubsonic Server with the following requirements:

1. [search3](https://opensubsonic.netlify.app/docs/endpoints/search3/) **must** allow empty string to query everything
2. [child](https://opensubsonic.netlify.app/docs/responses/child/) returns `musicBrainzId` where possible.

Note that this application only imports tracks that are tagged with MusicBrainz IDs.

## Running

There are two ways to run this application:

1. Via Docker
2. Via native install

### Docker

1. Build the image: `docker build -t troi-subsonic-generator .`
2. Use the provided `docker-compose.yml`, and adjust the `$HOST_PATH` for local volume and `example.env` to use your actual OpenSubsonic Server/user.
3. Run `docker compose up` (or equivalent `docker run`).

Configurations are in `example.env`.
Additionally, [Gunicorn](https://docs.gunicorn.org/en/stable/settings.html) settings are specified in the `gunicorn.conf.py` file.

### Natively

You can also run this application natively on the host.

#### Build requirements

1. Python > 3.8, < 3.13
2. [Bun](https://bun.sh/)

#### Optional Virtual Environment

It is recommended that you set up a [virtual environment](https://virtualenv.pypa.io/en/latest/user_guide.html) first.
This prevents Python dependencies from mixing with other projects.

On Linux/Mac

```bash
virtualenv env
source env/bin/activate
```

On Windows

```
virtualenv env
.\env\Scripts\activate
```

#### Install Python dependencies

To install the Python dependencies, just do the following:

```bash
pip install --no-deps -r requirements.txt
```

> Note the `--no-deps` is because some dependencies of Troi have manually been patched out

#### Build the UI

From the `ui` directory, run the following:

```bash
# Build and package UI
cd ui
bun install
bun run build
```

#### Running

To run this app natively, just do

```bash
python3 main.py
```

To change application settings (e.g. caching), modify the `.env` file, and to change server settings, modify `gunicorn.conf.py`.

## Usage

When you visit the page, you will be prompted to log in.
The username/password are whatever credentials you would log in to your Subsonic server.

Initially, the database will be entirely empty, so you will need to click on the magnifying glass (Scan Library).
This will fetch every song from your library, and for any song with a MBID, it will lookup metadata (artists,genres) in MusicBrainz.
Note that these artist names/genres may be different from the names you have specified in your file.

Once the scan finishes (or you refresh early), you will have the ability to generate playlists.
There are three steps:

1. Select a "difficulty". This _roughly_ translates to popularity/similarity, with easy being very similar/popular relative to your query, and hard being less similar.
2. Add one or more rules. Additional rules are an "OR". For example, if you have Artist: "Rick Astley" ang Genre: "Pop", your playlist will be an mix of the two.
3. Submit! Wait a bit, and you should hopefully get a playlist. You can then drag around/remove items and playlist name.
4. Save playlist! This will create a new playlist under your user.

## Development

If you want to develop, follow the steps to install natively, then do the following in two separate windows:

Make sure to set `MODE=debug` in your `.env` (or environment) to enable hot reloading of the backend.

```bash
# From the base of the directory
python3 main.py

# In another window, in UI directory
PORT=5000 bun run dev
```

This will start a dev server on :5173, with requests proxied to the Flask app.
Both applications can be hot reloaded

## License

Whatever's compatible with Troi. The LICENSE in repository is GPLv2, and in Python GPLv3. GPLv2 or later.
