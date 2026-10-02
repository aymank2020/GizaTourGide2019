import test from "node:test";
import assert from "node:assert/strict";
import {
  places,
  contentVersion,
  filterPlaces,
  parseFavorites,
} from "../places.mjs";
test("all places have distinct bilingual labels and official https sources", () => {
  assert.equal(places.length, 4);
  assert.match(contentVersion, /^\d{4}-\d{2}-\d{2}\.\d+$/);
  assert.equal(new Set(places.map((x) => x.id)).size, 4);
  for (const place of places) {
    assert.ok(place.ar && place.en && place.arSummary && place.enSummary);
    assert.equal(
      new Date(place.reviewedAt).toISOString().slice(0, 10),
      place.reviewedAt,
    );
    assert.match(
      place.source,
      /^https:\/\/(egymonuments.gov.eg|www.experienceegypt.eg)\//,
    );
  }
});
test("search works in Arabic and English and combines visit list", () => {
  assert.equal(filterPlaces("دهشور")[0].id, "dahshur");
  assert.equal(filterPlaces("SAQQARA")[0].id, "saqqara");
  assert.equal(filterPlaces("giza", new Set(["gem"])).length, 1);
  assert.equal(filterPlaces("missing").length, 0);
});
test("stored visit list rejects corrupt, duplicate or unknown ids", () => {
  assert.deepEqual([...parseFavorites('["giza","gem"]')], ["giza", "gem"]);
  for (const value of ["{}", '["unknown"]', '["giza","giza"]', "broken"])
    assert.throws(() => parseFavorites(value));
});
