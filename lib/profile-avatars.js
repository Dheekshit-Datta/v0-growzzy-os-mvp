export const CURATED_AVATARS = [
    "https://api.dicebear.com/10.x/notionists/svg?seed=Aria&backgroundColor=dbeafe",
    "https://api.dicebear.com/10.x/notionists/svg?seed=Jude&backgroundColor=fee2e2",
    "https://api.dicebear.com/10.x/notionists/svg?seed=Mira&backgroundColor=ecfccb",
    "https://api.dicebear.com/10.x/notionists/svg?seed=Theo&backgroundColor=fef3c7",
    "https://api.dicebear.com/10.x/notionists/svg?seed=Noor&backgroundColor=fce7f3",
    "https://api.dicebear.com/10.x/notionists/svg?seed=Kai&backgroundColor=ccfbf1",
    "https://api.dicebear.com/10.x/notionists/svg?seed=Iris&backgroundColor=ede9fe",
    "https://api.dicebear.com/10.x/notionists/svg?seed=Leo&backgroundColor=ffedd5",
];
const UPLOAD_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
export function isAllowedProfileImage(value) {
    return value === "" || CURATED_AVATARS.includes(value) || UPLOAD_PATTERN.test(value);
}
