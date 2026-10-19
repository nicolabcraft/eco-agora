<script setup lang="ts">
import { computed, h, type VNode } from 'vue';

/**
 * Affiche un texte balise par Eco (resultats d'election, descriptions...).
 *
 * Eco produit son propre balisage : <table>, <nl>, <style="Positive">,
 * <color=#..>, <link="click:...">... Le retirer ecrase les tableaux (« Oui2Non1 »),
 * l'afficher tel quel montre les balises. On le traduit donc en elements.
 *
 * Securite : aucun v-html. Les noeuds sont construits par Vue ; le texte est
 * toujours echappe ; seules des balises d'une liste fermee sont produites, sans
 * attribut venant du texte, sauf une couleur validee. Ces textes peuvent etre
 * ecrits par des joueurs.
 */
const props = defineProps<{ texte: string | null | undefined }>();

interface Noeud { tag: string; classe?: string; style?: string; enfants: Array<Noeud | string>; cache?: boolean }

/** Balises traduites telles quelles. */
const DIRECTES: Record<string, string> = { b: 'strong', i: 'em', u: 'u', s: 's', table: 'table', tr: 'tr', th: 'th', td: 'td', sub: 'sub', sup: 'sup' };

/** Styles nommes d'Eco -> classe de couleur du panel. */
function classeStyle(nom: string): string | undefined {
  const n = nom.toLowerCase();
  if (n.includes('positive') || n.includes('success') || n.includes('good')) return 'eco-t--ok';
  if (n.includes('error') || n.includes('negative') || n.includes('bad')) return 'eco-t--ko';
  if (n.includes('warning')) return 'eco-t--warn';
  if (n.includes('info')) return 'eco-t--info';
  return undefined;
}

function couleur(valeur: string): string | undefined {
  const v = valeur.replace(/["']/g, '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(v) ? `color:${v}` : undefined;
}

function analyser(source: string): Noeud {
  const racine: Noeud = { tag: 'span', enfants: [] };
  const pile: Noeud[] = [racine];
  const ouverts: string[] = ['#'];
  const motif = /<(\/?)([a-zA-Z#][\w#-]*)(?:\s*=\s*([^>]*))?[^>]*>/g;
  let fin = 0;
  let m: RegExpExecArray | null;

  const ajouterTexte = (t: string): void => {
    if (!t) return;
    const texte = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    pile[pile.length - 1].enfants.push(texte);
  };

  while ((m = motif.exec(source)) !== null) {
    ajouterTexte(source.slice(fin, m.index));
    fin = motif.lastIndex;
    const fermante = m[1] === '/';
    let nom = m[2].toLowerCase();
    const valeur = m[3] ?? '';
    if (nom.startsWith('#')) nom = 'color'; // raccourci <#ff6b0d>

    if (fermante) {
      // On ferme jusqu'a la balise correspondante, si elle est ouverte.
      const i = ouverts.lastIndexOf(nom);
      if (i > 0) { pile.length = i; ouverts.length = i; }
      continue;
    }
    if (nom === 'br') { pile[pile.length - 1].enfants.push({ tag: 'br', enfants: [] }); continue; }

    let noeud: Noeud;
    if (DIRECTES[nom]) noeud = { tag: DIRECTES[nom], enfants: [] };
    else if (nom === 'nl') noeud = { tag: 'div', enfants: [] };
    else if (nom === 'style') noeud = { tag: 'span', classe: classeStyle(valeur), enfants: [] };
    else if (nom === 'color') noeud = { tag: 'span', style: couleur(m[2].startsWith('#') ? m[2] : valeur), enfants: [] };
    // Liens d'action du jeu (« Afficher tous les votes ») : sans objet sur le web.
    else if (nom === 'link') noeud = { tag: 'span', enfants: [], cache: /^["']?click:/i.test(valeur) };
    else noeud = { tag: 'span', enfants: [] }; // size, align, font... : contenu conserve

    pile[pile.length - 1].enfants.push(noeud);
    pile.push(noeud);
    ouverts.push(nom);
  }
  ajouterTexte(source.slice(fin));
  return racine;
}

function rendre(n: Noeud | string): VNode | string | null {
  if (typeof n === 'string') return n;
  if (n.cache) return null;
  const enfants = n.enfants.map(rendre).filter((x): x is VNode | string => x !== null);
  // Une ligne <nl> vide sert d'espacement : on la garde courte.
  if (n.tag === 'div' && enfants.every((e) => typeof e === 'string' && !e.trim())) return h('div', { class: 'eco-t__vide' });
  return h(n.tag, { class: n.classe, style: n.style }, n.tag === 'br' ? undefined : enfants);
}

const arbre = computed(() => rendre(analyser(props.texte ?? '')));
</script>

<template>
  <div class="eco-t"><component :is="() => arbre" /></div>
</template>

<style scoped>
.eco-t { line-height: 1.55; }
.eco-t :deep(table) { border-collapse: collapse; margin: var(--sp-2) 0; }
.eco-t :deep(th), .eco-t :deep(td) {
  padding: 4px 14px 4px 0; text-align: left; font-weight: 600;
  border-bottom: 1px solid var(--hairline);
}
.eco-t :deep(.eco-t__vide) { height: 6px; }
.eco-t :deep(.eco-t--ok) { color: #6fcf7f; }
.eco-t :deep(.eco-t--ko) { color: #ff8a8a; }
.eco-t :deep(.eco-t--warn) { color: #f0c419; }
.eco-t :deep(.eco-t--info) { color: #6fb6e8; }
</style>
