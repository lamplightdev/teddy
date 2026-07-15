import { html, render } from "lit-html";

/**
 * @typedef {Object} Track
 * @property {string} id
 * @property {string} name
 * @property {string} image
 * @property {string} audio
 */

class Tracks extends HTMLElement {
	/**
	 * @type {Track[]}
	 */
	tracks = [];

	async connectedCallback() {
		await this.load();
		this.render();
	}

	async load() {
		const response = await fetch(
			"https://api.jamendo.com/v3.0/artists/tracks/?client_id=e7e971c2&order=popularity_total&namesearch=lunatic",
		);
		if (response.ok) {
			const { headers, results } =
				/** @type {{ headers: { status: string }, results: {
				tracks: {
					id: string;
					name: string;
					album_image: string;
					audio: string;
				}[];
			}[] }} */ (await response.json());

			if (headers.status === "success" && results.length > 0) {
				const artist = results[0];
				const { tracks } = artist;

				this.tracks = tracks.map((track) => {
					return {
						id: track.id,
						name: track.name,
						image: track.album_image,
						audio: track.audio,
					};
				});
			}
		}
	}

	/**
	 * @param {Track} track
	 */
	play(track) {
		const customEvent = new CustomEvent("play-track", {
			detail: { track, start: true },
			bubbles: true,
		});

		this.dispatchEvent(customEvent);
	}

	render() {
		const content = html`${this.tracks.map((track) => {
			return html`
      <div class="track">
        <img src="${track.image}" alt="${track.name}" loading="lazy"" />
        <p>${track.name}</p>
        <button class="primary" @click=${() => this.play(track)}>Play</button>
      </div>
      `;
		})}`;

		render(content, this);
	}
}

customElements.define("bop-tracks", Tracks);
