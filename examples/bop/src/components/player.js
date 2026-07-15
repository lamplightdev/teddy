import { html, render } from "lit-html";

class Player extends HTMLElement {
	/**
	 * @type {import('./tracks').Track |null}
	 */
	track = null;

	connectedCallback() {
		this.render();

		document.addEventListener("play-track", this.play);
	}

	disconnectedCallback() {
		document.removeEventListener("play-track", this.play);
	}

	/**
	 * @param {CustomEvent} event
	 */
	play = (event) => {
		const { track, start } = event.detail;

		this.track = track;
		this.render();

		if ("mediaSession" in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: track.name,
				artist: "Artist Name",
				album: "Album Name",
				artwork: [
					{
						src: track.image,
					},
				],
			});
		}
	};

	render() {
		if (!this.track) {
			this.classList.add("hide");
		} else {
			this.classList.remove("hide");
		}

		const content = html`<div>${this.track ? this.track.name : ""}</div>${this.track ? html`<audio src="${this.track.audio}" controls autoplay></audio>` : ""}`;

		render(content, this);
	}
}

customElements.define("bop-player", Player);
